import { after, NextResponse } from "next/server"
import { advanceMedia, markUploadedVideo } from "@/lib/ai-index"
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
import { FILE_TOO_BIG_MESSAGE, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Writes the library row after the browser has sent the file to Storage.

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
  }
  const id = typeof record.id === "string" ? record.id : ""
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  const fileName = typeof record.fileName === "string" ? record.fileName : ""
  const mimeType = typeof record.mimeType === "string" ? record.mimeType : ""
  const storagePath = typeof record.storagePath === "string" ? record.storagePath : ""

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

  if (typeof info.data.size === "number" && info.data.size > MAX_UPLOAD_BYTES) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    return NextResponse.json({ error: FILE_TOO_BIG_MESSAGE }, { status: 413 })
  }

  const inserted = await supabase
    .from("media_items")
    .insert({
      id,
      project_id: projectId,
      title: titleFromFileName(fileName),
      media_type: mediaType,
      storage_path: storagePath,
      mime_type: mimeType || info.data.contentType || null,
    })
    .select(
      "id, project_id, title, media_type, storage_path, mime_type, created_at",
    )
    .single()

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

  const queued = await markUploadedVideo(id, storagePath, mediaType)
  if (queued) {
    after(() => {
      void advanceMedia(id)
    })
  }

  const signed = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  const item = rowToSavedMedia(inserted.data as MediaRow, signed.data?.signedUrl ?? null)
  if (queued) {
    item.indexStatus = "pending"
    item.indexError = null
  }

  return NextResponse.json({ item })
}
