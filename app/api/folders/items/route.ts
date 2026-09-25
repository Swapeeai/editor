import { NextResponse } from "next/server"
import { addItemsToFolder, replaceItemFolders } from "@/lib/folder-actions"
import { isProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!getSupabaseAdmin()) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as {
    projectId?: unknown
    folderId?: unknown
    folderIds?: unknown
    mediaId?: unknown
    mediaIds?: unknown
  }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }

  if (typeof record.mediaId === "string" && Array.isArray(record.folderIds)) {
    const folderIds = record.folderIds.filter((id): id is string => typeof id === "string")
    const result = await replaceItemFolders(projectId, record.mediaId, folderIds)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
  }

  const folderId = typeof record.folderId === "string" ? record.folderId : ""
  const mediaIds = Array.isArray(record.mediaIds)
    ? record.mediaIds.filter((id): id is string => typeof id === "string")
    : []
  const result = await addItemsToFolder(projectId, folderId, mediaIds)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, count: result.count })
}
