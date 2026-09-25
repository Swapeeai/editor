import { after, NextResponse } from "next/server"
import { advanceMedia } from "@/lib/ai-index"
import { isProjectId, projectById } from "@/lib/projects"
import { movedStoragePath, rowToSavedMedia, type MediaRow } from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as { id?: unknown; projectId?: unknown }
  const id = typeof record.id === "string" ? record.id : ""
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!UUID.test(id) || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Choose a project to move this file to." }, { status: 400 })
  }

  const existing = await supabase
    .from("media_items")
    .select("id, project_id, title, media_type, storage_path, mime_type, created_at")
    .eq("id", id)
    .maybeSingle()

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "That file is not in the library." }, { status: 404 })
  }

  const row = existing.data as MediaRow
  if (row.project_id === projectId) {
    return NextResponse.json({ error: "That file is already in this project." }, { status: 400 })
  }

  const nextPath = movedStoragePath(row.storage_path, projectId)
  if (!nextPath) {
    return NextResponse.json({ error: "Could not move that file." }, { status: 400 })
  }

  const moved = await supabase.storage.from(MEDIA_BUCKET).move(row.storage_path, nextPath)
  if (moved.error) {
    return NextResponse.json(
      { error: `Could not move the file to ${projectById(projectId).name}.` },
      { status: 502 },
    )
  }

  const updated = await supabase
    .from("media_items")
    .update({ project_id: projectId, storage_path: nextPath })
    .eq("id", id)
    .select("id, project_id, title, media_type, storage_path, mime_type, created_at")
    .single()

  if (updated.error || !updated.data) {
    await supabase.storage.from(MEDIA_BUCKET).move(nextPath, row.storage_path)
    return NextResponse.json(
      { error: "The file moved in Storage, then the library row failed, so it was put back." },
      { status: 502 },
    )
  }

  const isVideo = row.media_type === "video" && !nextPath.includes("/exports/")
  if (isVideo) {
    const reset = await supabase
      .from("media_items")
      .update({
        twelvelabs_video_id: null,
        index_status: "pending",
        index_error: null,
      })
      .eq("id", id)
    if (!reset.error) {
      after(() => {
        void advanceMedia(id)
      })
    }
  }

  const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(nextPath, 60 * 60)
  const item = rowToSavedMedia(updated.data as MediaRow, signed.data?.signedUrl ?? null)
  if (isVideo) {
    item.indexStatus = "pending"
  }
  return NextResponse.json({ item })
}
