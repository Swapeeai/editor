import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { thumbnailFromFile } from "@/lib/thumbnail"
import { isProjectId } from "@/lib/projects"
import {
  mediaTypeFromFile,
  rowToSavedMedia,
  safeFileName,
  titleFromFileName,
  type MediaRow,
} from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { FILE_TOO_BIG_MESSAGE, maxUploadBytes } from "@/lib/upload-limit"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function libraryTitle(requested: string, fileName: string) {
  const cleaned = requested.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120)
  return cleaned || titleFromFileName(fileName)
}

// Writes the library row after the browser has sent the file to Storage.

export async function POST(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "The upload request was empty or too hard to read." },
      { status: 400 },
    )
  }

  const record = body as {
    id?: unknown
    projectId?: unknown
    fileName?: unknown
    mimeType?: unknown
    storagePath?: unknown
    title?: unknown
  }
  const id = typeof record.id === "string" ? record.id : ""
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  const fileName = typeof record.fileName === "string" ? record.fileName : ""
  const mimeType = typeof record.mimeType === "string" ? record.mimeType : ""
  const storagePath = typeof record.storagePath === "string" ? record.storagePath : ""
  const requestedTitle = typeof record.title === "string" ? record.title : ""
  const durationRaw = (body as { durationSeconds?: unknown }).durationSeconds
  const durationSeconds =
    typeof durationRaw === "number" && durationRaw > 0 && durationRaw < 60 * 60 * 12
      ? durationRaw
      : null

  if (!UUID.test(id) || !isProjectId(projectId)) {
    return NextResponse.json(
      {
        error:
          "Pick a project first: Ibiza Pole Retreat, Phuket Pole Retreat, or Flirty Fitness.",
      },
      { status: 400 },
    )
  }

  const expectedPath = `${projectId}/${id}-${safeFileName(fileName)}`
  if (!fileName || storagePath !== expectedPath) {
    return NextResponse.json(
      { error: "The saved file path did not match. Nothing was added to the library." },
      { status: 400 },
    )
  }

  const mediaType = mediaTypeFromFile({ type: mimeType, name: fileName })
  if (!mediaType) {
    return NextResponse.json(
      { error: "Choose a photo or a video." },
      { status: 400 },
    )
  }

  const info = await supabase.storage.from(MEDIA_BUCKET).info(storagePath)
  if (info.error || !info.data) {
    return NextResponse.json(
      { error: "The file did not arrive in Storage. Nothing was added to the library." },
      { status: 502 },
    )
  }

  if (typeof info.data.size === "number" && info.data.size > maxUploadBytes()) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    return NextResponse.json({ error: FILE_TOO_BIG_MESSAGE }, { status: 413 })
  }

  const row = {
    id,
    project_id: projectId,
    title: libraryTitle(requestedTitle, fileName),
    media_type: mediaType,
    storage_path: storagePath,
    mime_type: mimeType || info.data.contentType || null,
    ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}),
  }
  let inserted = await supabase
    .from("media_items")
    .insert(row)
    .select(
      "id, project_id, title, media_type, storage_path, mime_type, created_at",
    )
    .single()
  if (
    inserted.error &&
    durationSeconds != null &&
    /duration_seconds|schema cache|could not find/i.test(inserted.error.message)
  ) {
    const withoutDuration = {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      media_type: row.media_type,
      storage_path: row.storage_path,
      mime_type: row.mime_type,
    }
    inserted = await supabase
      .from("media_items")
      .insert(withoutDuration)
      .select(
        "id, project_id, title, media_type, storage_path, mime_type, created_at",
      )
      .single()
  }

  if (inserted.error || !inserted.data) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    const missingTable = /media_items|relation/i.test(inserted.error?.message ?? "")
    return NextResponse.json(
      {
        error: missingTable
          ? "The media_items table is missing. Paste supabase/schema.sql in the Supabase SQL editor, then try again."
          : "The library row could not be saved, so the file was removed from Storage.",
      },
      { status: 502 },
    )
  }

  const signed = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  const item = rowToSavedMedia(inserted.data as MediaRow, signed.data?.signedUrl ?? null)
  item.durationSeconds = durationSeconds

  if (mediaType === "video" && signed.data?.signedUrl) {
    const dir = await mkdtemp(join(tmpdir(), "retreat-upload-thumb-"))
    try {
      const filePath = join(dir, "video.mp4")
      const downloaded = await fetch(signed.data.signedUrl)
      if (downloaded.ok) {
        await writeFile(filePath, Buffer.from(await downloaded.arrayBuffer()))
        const stored = await thumbnailFromFile(id, projectId, filePath, durationSeconds)
        if (stored.ok) {
          item.thumbnailPath = stored.thumbnailPath
          item.thumbnailUrl = stored.thumbnailUrl
        }
      }
    } catch {
      // The file is already in the library. A missing still can be generated later.
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  return NextResponse.json({ item })
}
