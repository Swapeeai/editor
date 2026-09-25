import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cutVideoFile, probeDuration } from "@/lib/cut-clip"
import { isProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { maxUploadBytes } from "@/lib/upload-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again. The part was still saved."

function cleanTitle(value: string) {
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120)
}

function missingColumn(message: string) {
  return /schema cache|could not find|column/i.test(message)
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return Response.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as {
    id?: unknown
    start?: unknown
    end?: unknown
    title?: unknown
  }
  const id = typeof record.id === "string" ? record.id : ""
  const start = Number(record.start)
  const end = Number(record.end)
  const title = typeof record.title === "string" ? cleanTitle(record.title) : ""
  if (!UUID.test(id)) {
    return Response.json({ error: "That video could not be found." }, { status: 400 })
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return Response.json({ error: "Set a start and an end, with the end after the start." }, { status: 400 })
  }
  if (end - start < 0.2) {
    return Response.json({ error: "Choose at least 0.2 seconds." }, { status: 400 })
  }
  if (end - start > 60 * 30) {
    return Response.json({ error: "Cut a part shorter than 30 minutes." }, { status: 400 })
  }
  if (!title) {
    return Response.json({ error: "Type a name for this part." }, { status: 400 })
  }

  const withKeywords = await supabase
    .from("media_items")
    .select("id, project_id, title, media_type, storage_path, keywords")
    .eq("id", id)
    .maybeSingle()
  const existing =
    withKeywords.error && missingColumn(withKeywords.error.message)
      ? await supabase
          .from("media_items")
          .select("id, project_id, title, media_type, storage_path")
          .eq("id", id)
          .maybeSingle()
      : withKeywords
  if (existing.error || !existing.data) {
    return Response.json({ error: "That video is not in the library." }, { status: 404 })
  }
  const source = existing.data as {
    id: string
    project_id: string
    title: string
    media_type: string
    storage_path: string
    keywords?: string | null
  }
  if (!isProjectId(source.project_id) || source.media_type !== "video") {
    return Response.json({ error: "Only a video can be cut." }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      const dir = await mkdtemp(join(tmpdir(), "retreat-cut-src-"))
      const sourcePath = join(dir, "source.mp4")
      let cutCleanup: (() => Promise<void>) | null = null
      try {
        send({ progress: "Opening the video…" })
        const signed = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(source.storage_path, 60 * 30)
        if (signed.error || !signed.data?.signedUrl) {
          throw new Error("Could not open that video.")
        }
        const downloaded = await fetch(signed.data.signedUrl)
        if (!downloaded.ok || !downloaded.body) {
          throw new Error("Could not download that video.")
        }
        const lengthHeader = downloaded.headers.get("content-length")
        const length = lengthHeader ? Number(lengthHeader) : 0
        if (length > maxUploadBytes()) {
          throw new Error("That video is too large to cut here.")
        }
        const bytes = Buffer.from(await downloaded.arrayBuffer())
        if (bytes.length > maxUploadBytes()) {
          throw new Error("That video is too large to cut here.")
        }
        await writeFile(sourcePath, bytes)
        const full = await probeDuration(sourcePath)
        if (full != null && end > full + 0.05) {
          throw new Error(`This video is ${full.toFixed(1)} seconds. Set the end at or before that.`)
        }

        const cut = await cutVideoFile(sourcePath, start, Math.min(end, full ?? end), (label) => {
          send({ progress: label })
        })
        cutCleanup = cut.cleanup

        send({ progress: "Saving this part to the library…" })
        const partId = crypto.randomUUID()
        const storagePath = `${source.project_id}/${partId}-cut.mp4`
        const fileBytes = await readFile(cut.path)
        const uploaded = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, fileBytes, {
          contentType: "video/mp4",
          upsert: false,
        })
        if (uploaded.error) {
          throw new Error("Could not save the cut file.")
        }

        const seconds = Math.round((end - start) * 10) / 10
        const row: Record<string, unknown> = {
          id: partId,
          project_id: source.project_id,
          title,
          media_type: "video",
          storage_path: storagePath,
          mime_type: "video/mp4",
          keywords: typeof source.keywords === "string" ? source.keywords : "",
          duration_seconds: seconds,
          source_media_id: source.id,
          source_title: source.title,
        }
        let warning: string | null = null
        let payload: Record<string, unknown> = row
        let inserted = await supabase.from("media_items").insert(payload)
        const optional = ["keywords", "duration_seconds", "source_media_id", "source_title"]
        while (inserted.error && missingColumn(inserted.error.message)) {
          warning = SCHEMA_MESSAGE
          const message = inserted.error.message
          const drop = optional.find((key) => message.includes(key) && key in payload)
          if (!drop) {
            payload = {
              id: partId,
              project_id: source.project_id,
              title,
              media_type: "video",
              storage_path: storagePath,
              mime_type: "video/mp4",
            }
            inserted = await supabase.from("media_items").insert(payload)
            break
          }
          const next = { ...payload }
          delete next[drop]
          payload = next
          inserted = await supabase.from("media_items").insert(payload)
        }
        if (inserted.error) {
          await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
          throw new Error("The cut file was made, but it could not be added to the library.")
        }

        const folders = await supabase
          .from("folder_items")
          .select("folder_id")
          .eq("media_item_id", source.id)
        if (!folders.error && (folders.data ?? []).length > 0) {
          const links = (folders.data ?? []).flatMap((item) => {
            const folderId = (item as { folder_id?: unknown }).folder_id
            return typeof folderId === "string" ? [{ folder_id: folderId, media_item_id: partId }] : []
          })
          if (links.length > 0) {
            const linked = await supabase.from("folder_items").insert(links)
            if (linked.error && !missingColumn(linked.error.message)) {
              warning = warning ?? "The part was saved, but it could not be added to the same folders."
            }
          }
        }

        send({
          done: true,
          id: partId,
          title,
          mode: cut.mode,
          warning,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not cut that part."
        send({ error: message })
      } finally {
        await cutCleanup?.()
        await rm(dir, { recursive: true, force: true })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}
