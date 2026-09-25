import { NextResponse } from "next/server"
import { isStoredHeic, jpegNameFromHeic, jpegTitleForStored } from "@/lib/heic-photo"
import { isProjectId } from "@/lib/projects"
import { fileNameFromStoragePath, safeFileName, type MediaRow } from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import {
  FILE_TOO_BIG_MESSAGE,
  MAX_UPLOAD_BYTES,
  resumableUploadEndpoint,
} from "@/lib/upload-limit"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadItem(id: string, projectId: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { error: NOT_CONNECTED_MESSAGE, status: 503 as const }
  }
  const { data, error } = await supabase
    .from("media_items")
    .select("id, project_id, title, media_type, storage_path, mime_type")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) {
    return { error: "That file is no longer in the library.", status: 404 as const }
  }
  const row = data as MediaRow
  if (row.project_id !== projectId) {
    return { error: "That file is in a different project.", status: 400 as const }
  }
  return { row, supabase }
}

export async function POST(request: Request) {
  if (!getSupabaseAdmin()) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "The request was empty or too hard to read." },
      { status: 400 },
    )
  }

  const record = body as {
    action?: unknown
    id?: unknown
    projectId?: unknown
    storagePath?: unknown
    size?: unknown
  }
  const action = record.action === "finish" ? "finish" : "start"
  const id = typeof record.id === "string" ? record.id : ""
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!UUID.test(id) || !isProjectId(projectId)) {
    return NextResponse.json({ error: "That file could not be found." }, { status: 400 })
  }

  const loaded = await loadItem(id, projectId)
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  }

  if (action === "start") {
    return startConvert(loaded.row, loaded.supabase, projectId, record.size)
  }
  const storagePath = typeof record.storagePath === "string" ? record.storagePath : ""
  return finishConvert(loaded.row, loaded.supabase, projectId, storagePath)
}

async function startConvert(
  row: MediaRow,
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  projectId: string,
  size: unknown,
) {
  const fileName = fileNameFromStoragePath(row.storage_path)
  const stored = {
    mimeType: row.mime_type,
    title: row.title,
    storagePath: row.storage_path,
    fileName,
  }
  if (!isStoredHeic(stored)) {
    return NextResponse.json(
      { error: "That file is already a normal photo or video." },
      { status: 400 },
    )
  }

  const bytes = typeof size === "number" ? size : Number.NaN
  if (Number.isFinite(bytes) && bytes > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: FILE_TOO_BIG_MESSAGE }, { status: 413 })
  }

  const jpegName = jpegNameFromHeic(fileName)
  const newId = crypto.randomUUID()
  const storagePath = `${projectId}/${newId}-${safeFileName(jpegName)}`
  const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUploadUrl(storagePath)
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not start saving the JPEG. The original photo is unchanged." },
      { status: 502 },
    )
  }

  const download = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60)
  if (download.error || !download.data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not open the iPhone photo. It is still in the library." },
      { status: 502 },
    )
  }

  return NextResponse.json({
    downloadUrl: download.data.signedUrl,
    storagePath,
    fileName: jpegName,
    title: jpegTitleForStored(stored),
    signedUrl: signed.data.signedUrl,
    token: signed.data.token,
    resumableEndpoint: resumableUploadEndpoint(),
  })
}

async function finishConvert(
  row: MediaRow,
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  projectId: string,
  storagePath: string,
) {
  const fileName = fileNameFromStoragePath(row.storage_path)
  if (
    !isStoredHeic({
      mimeType: row.mime_type,
      title: row.title,
      storagePath: row.storage_path,
      fileName,
    })
  ) {
    return NextResponse.json(
      { error: "That file is already a normal photo or video." },
      { status: 400 },
    )
  }
  if (
    !storagePath.startsWith(`${projectId}/`) ||
    storagePath.includes("..") ||
    !/\.jpe?g$/i.test(storagePath) ||
    storagePath === row.storage_path
  ) {
    return NextResponse.json(
      { error: "The converted photo could not be saved. The original is unchanged." },
      { status: 400 },
    )
  }

  const info = await supabase.storage.from(MEDIA_BUCKET).info(storagePath)
  const bytes = info.data?.size ?? 0
  if (info.error || bytes <= 0) {
    return NextResponse.json(
      { error: "The JPEG did not finish saving. The original iPhone photo is unchanged." },
      { status: 400 },
    )
  }
  if (bytes > MAX_UPLOAD_BYTES) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    return NextResponse.json({ error: FILE_TOO_BIG_MESSAGE }, { status: 413 })
  }

  const title = jpegTitleForStored({
    title: row.title,
    fileName,
  })
  const { error } = await supabase
    .from("media_items")
    .update({
      title,
      mime_type: "image/jpeg",
      storage_path: storagePath,
      media_type: "photo",
    })
    .eq("id", row.id)
    .eq("project_id", projectId)

  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    return NextResponse.json(
      { error: "Could not update the library row. The original photo is unchanged." },
      { status: 502 },
    )
  }

  const removed = await supabase.storage.from(MEDIA_BUCKET).remove([row.storage_path])
  if (removed.error) {
    return NextResponse.json({
      title,
      storagePath,
      warning: "The JPEG is saved. The old iPhone file is still in Storage.",
    })
  }

  return NextResponse.json({ title, storagePath })
}
