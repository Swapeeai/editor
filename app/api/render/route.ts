import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { isProjectId, type ProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { clipDuration } from "@/lib/moment-timing"
import { titleCardPng } from "@/lib/title-card"
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const require = createRequire(import.meta.url)
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SceneInput = {
  mediaId?: unknown
  startSeconds?: unknown
  endSeconds?: unknown
}

type MediaRow = {
  id: string
  project_id: string
  title: string
  media_type: string
  storage_path: string
  mime_type: string | null
}

function ffmpegBinary() {
  const found = require("ffmpeg-static") as string | null
  if (!found) {
    throw new Error(
      "The video tool is missing. Run npm install, then restart the app.",
    )
  }
  return found
}

function runFfmpeg(args: string[]) {
  const binary = ffmpegBinary()
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "ignore", "pipe"] })
    child.stderr.on("data", () => {
      // Keep the pipe flowing. The user sees a plain error, not the tool log.
    })
    child.on("error", () => {
      reject(
        new Error(
          "The video tool is missing. Run npm install, then restart the app.",
        ),
      )
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          "Could not make the video. Check that each scene is a real photo or video, then try again.",
        ),
      )
    })
  })
}

const frame =
  "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30"

async function writeClip(input: string, output: string, options: {
  photo: boolean
  start: number
  duration: number
}) {
  const args = ["-y"]
  if (options.photo) {
    args.push("-loop", "1", "-t", String(options.duration), "-i", input)
  } else {
    args.push(
      "-ss",
      String(options.start),
      "-t",
      String(options.duration),
      "-i",
      input,
    )
  }
  args.push(
    "-f",
    "lavfi",
    "-t",
    String(options.duration),
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-vf",
    frame,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    output,
  )
  await runFfmpeg(args)
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "The export request was empty." },
      { status: 400 },
    )
  }

  const record = body as {
    projectId?: unknown
    titleText?: unknown
    date?: unknown
    location?: unknown
    scenes?: unknown
  }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json(
      { error: "Pick a project first." },
      { status: 400 },
    )
  }

  const scenes = Array.isArray(record.scenes) ? record.scenes : []
  const parsed = scenes.map((scene) => {
    const item = scene as SceneInput
    const mediaId = typeof item.mediaId === "string" ? item.mediaId : ""
    const start = typeof item.startSeconds === "number" ? item.startSeconds : 0
    const end = typeof item.endSeconds === "number" ? item.endSeconds : null
    return {
      mediaId,
      start: Number.isFinite(start) ? Math.min(600, Math.max(0, start)) : 0,
      end:
        end != null && Number.isFinite(end) ? Math.min(600, Math.max(0, end)) : null,
    }
  })

  if (parsed.length === 0 || parsed.some((scene) => !UUID.test(scene.mediaId))) {
    return NextResponse.json(
      {
        error:
          "Export uses saved files only. Import from Google Drive, match those titles, and remove any scene that has no clip.",
      },
      { status: 400 },
    )
  }

  const listed = await supabase
    .from("media_items")
    .select("id, project_id, title, media_type, storage_path, mime_type")
    .eq("project_id", projectId)
    .in(
      "id",
      parsed.map((scene) => scene.mediaId),
    )

  if (listed.error) {
    return NextResponse.json(
      { error: "Could not read the library." },
      { status: 502 },
    )
  }

  const byId = new Map(
    ((listed.data ?? []) as MediaRow[]).map((row) => [row.id, row]),
  )
  if (parsed.some((scene) => !byId.has(scene.mediaId))) {
    return NextResponse.json(
      { error: "A scene does not belong to this project. Build the storyboard again." },
      { status: 400 },
    )
  }

  const dir = await mkdtemp(join(tmpdir(), "retreat-export-"))
  const notes: string[] = [
    "This export has no sound. It is the picture only.",
  ]

  try {
    const parts: string[] = []
    const title = typeof record.titleText === "string" ? record.titleText.trim() : ""
    const date = typeof record.date === "string" ? record.date.trim() : ""
    const location = typeof record.location === "string" ? record.location.trim() : ""
    const cardPng = titleCardPng([title, date, location].filter(Boolean))
    if (cardPng) {
      const cardImage = join(dir, "title.png")
      const card = join(dir, "title.mp4")
      await writeFile(cardImage, cardPng)
      await writeClip(cardImage, card, { photo: true, start: 0, duration: 3 })
      parts.push(card)
      notes.push("A plain title card was added at the start.")
    }

    for (let index = 0; index < parsed.length; index += 1) {
      const scene = parsed[index]
      const row = byId.get(scene.mediaId)
      if (!row) {
        continue
      }
      const signed = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 30)
      if (signed.error || !signed.data?.signedUrl) {
        return NextResponse.json(
          { error: `Could not open “${row.title}” from Storage.` },
          { status: 502 },
        )
      }
      const downloaded = await fetch(signed.data.signedUrl)
      if (!downloaded.ok) {
        return NextResponse.json(
          { error: `Could not download “${row.title}”.` },
          { status: 502 },
        )
      }
      const bytes = Buffer.from(await downloaded.arrayBuffer())
      if (bytes.length > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            error: `“${row.title}” is bigger than 50 MB. The free plan cannot use it. Pick a shorter clip.`,
          },
          { status: 413 },
        )
      }
      const photo = row.media_type === "photo"
      const ext = photo ? "img" : "vid"
      const source = join(dir, `source-${index}.${ext}`)
      await writeFile(source, bytes)
      const output = join(dir, `scene-${index}.mp4`)
      const duration = clipDuration({
        photo,
        start: photo ? 0 : scene.start,
        end: photo ? null : scene.end,
      })
      await writeClip(source, output, {
        photo,
        start: photo ? 0 : scene.start,
        duration,
      })
      parts.push(output)
    }

    if (parts.length === 0) {
      return NextResponse.json(
        { error: "There were no clips to export." },
        { status: 400 },
      )
    }

    const listPath = join(dir, "list.txt")
    await writeFile(
      listPath,
      parts.map((part) => `file '${part.replace(/'/g, "'\\''")}'`).join("\n"),
    )
    const finished = join(dir, "retreat.mp4")
    await runFfmpeg([
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      finished,
    ])

    const video = await readFile(finished)
    let saved = false
    if (video.length <= MAX_UPLOAD_BYTES) {
      const exportId = crypto.randomUUID()
      const storagePath = `${projectId as ProjectId}/exports/${exportId}-retreat.mp4`
      const uploaded = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, video, {
          contentType: "video/mp4",
          upsert: false,
        })
      if (!uploaded.error) {
        await supabase.from("media_items").insert({
          id: exportId,
          project_id: projectId,
          title: title || "Exported video",
          media_type: "video",
          storage_path: storagePath,
          mime_type: "video/mp4",
        })
        saved = true
      }
    } else {
      notes.push(
        "The finished video is over 50 MB, so it was not saved in the library. Download it from this page.",
      )
    }

    return new NextResponse(new Uint8Array(video), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="retreat-video.mp4"',
        "X-Export-Saved": saved ? "yes" : "no",
        "X-Export-Note": notes.join(" "),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not make the video."
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
