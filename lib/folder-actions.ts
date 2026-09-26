import "server-only"

import type { ProjectId } from "@/lib/projects"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const FOLDER_SCHEMA_MESSAGE =
  "Database update needed. Use the copy button in the library banner, paste the SQL in the Supabase SQL editor, and click Run."

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function cleanFolderName(value: string) {
  return value.replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ").slice(0, 80)
}

function missingFolderSchema(message: string) {
  return /schema cache|could not find|folders|folder_items/i.test(message)
}

function duplicateName(message: string) {
  return /duplicate|unique|23505/i.test(message)
}

async function mediaInProject(projectId: ProjectId, mediaIds: string[]) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { error: "Supabase is not connected." as const, ids: [] as string[] }
  }
  const ids = [...new Set(mediaIds.filter((id) => UUID.test(id)))]
  if (ids.length === 0) {
    return { error: "Select at least one file." as const, ids: [] as string[] }
  }
  const listed = await supabase
    .from("media_items")
    .select("id")
    .eq("project_id", projectId)
    .in("id", ids)
  if (listed.error) {
    return { error: "Could not read those files." as const, ids: [] as string[] }
  }
  const found = (listed.data ?? []).flatMap((row) =>
    typeof (row as { id?: unknown }).id === "string" ? [(row as { id: string }).id] : [],
  )
  if (found.length === 0) {
    return { error: "Those files are not in this project." as const, ids: [] as string[] }
  }
  return { error: null, ids: found }
}

export async function createFolder(projectId: ProjectId, rawName: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Supabase is not connected." }
  }
  const name = cleanFolderName(rawName)
  if (!name) {
    return { ok: false as const, status: 400, error: "Type a folder name." }
  }
  const inserted = await supabase
    .from("folders")
    .insert({ project_id: projectId, name })
    .select("id, name")
    .maybeSingle()
  if (inserted.error || !inserted.data) {
    if (inserted.error && missingFolderSchema(inserted.error.message)) {
      return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
    }
    if (inserted.error && duplicateName(inserted.error.message)) {
      return { ok: false as const, status: 400, error: `“${name}” is already a folder in this project.` }
    }
    return { ok: false as const, status: 502, error: "Could not create that folder." }
  }
  return { ok: true as const, folder: inserted.data }
}

export async function renameFolder(projectId: ProjectId, id: string, rawName: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Supabase is not connected." }
  }
  if (!UUID.test(id)) {
    return { ok: false as const, status: 400, error: "That folder could not be found." }
  }
  const name = cleanFolderName(rawName)
  if (!name) {
    return { ok: false as const, status: 400, error: "Type a folder name." }
  }
  const updated = await supabase
    .from("folders")
    .update({ name })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id")
  if (updated.error) {
    if (missingFolderSchema(updated.error.message)) {
      return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
    }
    if (duplicateName(updated.error.message)) {
      return { ok: false as const, status: 400, error: `“${name}” is already a folder in this project.` }
    }
    return { ok: false as const, status: 502, error: "Could not rename that folder." }
  }
  if (!updated.data || updated.data.length === 0) {
    return { ok: false as const, status: 404, error: "That folder is not in this project." }
  }
  return { ok: true as const, name }
}

export async function deleteFolder(projectId: ProjectId, id: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Supabase is not connected." }
  }
  if (!UUID.test(id)) {
    return { ok: false as const, status: 400, error: "That folder could not be found." }
  }
  const removed = await supabase.from("folders").delete().eq("id", id).eq("project_id", projectId).select("id")
  if (removed.error) {
    if (missingFolderSchema(removed.error.message)) {
      return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
    }
    return { ok: false as const, status: 502, error: "Could not delete that folder." }
  }
  if (!removed.data || removed.data.length === 0) {
    return { ok: false as const, status: 404, error: "That folder is not in this project." }
  }
  return { ok: true as const }
}

async function folderInProject(projectId: ProjectId, folderId: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase || !UUID.test(folderId)) {
    return false
  }
  const listed = await supabase
    .from("folders")
    .select("id")
    .eq("id", folderId)
    .eq("project_id", projectId)
    .maybeSingle()
  return !listed.error && Boolean(listed.data)
}

export async function addItemsToFolder(
  projectId: ProjectId,
  folderId: string,
  mediaIds: string[],
) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Supabase is not connected." }
  }
  if (!(await folderInProject(projectId, folderId))) {
    return { ok: false as const, status: 404, error: "That folder is not in this project." }
  }
  const media = await mediaInProject(projectId, mediaIds)
  if (media.error) {
    return { ok: false as const, status: 400, error: media.error }
  }
  const rows = media.ids.map((mediaId) => ({
    folder_id: folderId,
    media_item_id: mediaId,
  }))
  const saved = await supabase.from("folder_items").upsert(rows, {
    onConflict: "folder_id,media_item_id",
    ignoreDuplicates: true,
  })
  if (saved.error) {
    if (missingFolderSchema(saved.error.message)) {
      return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
    }
    return { ok: false as const, status: 502, error: "Could not add those files to the folder." }
  }
  return { ok: true as const, count: media.ids.length }
}

export async function replaceItemFolders(
  projectId: ProjectId,
  mediaId: string,
  folderIds: string[],
) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, status: 503, error: "Supabase is not connected." }
  }
  const media = await mediaInProject(projectId, [mediaId])
  if (media.error) {
    return { ok: false as const, status: 400, error: media.error }
  }
  const wanted = [...new Set(folderIds.filter((id) => UUID.test(id)))]
  const folders = await supabase.from("folders").select("id").eq("project_id", projectId)
  if (folders.error) {
    if (missingFolderSchema(folders.error.message)) {
      return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
    }
    return { ok: false as const, status: 502, error: "Could not read folders." }
  }
  const allowed = new Set(
    (folders.data ?? []).flatMap((row) =>
      typeof (row as { id?: unknown }).id === "string" ? [(row as { id: string }).id] : [],
    ),
  )
  const chosen = wanted.filter((id) => allowed.has(id))
  if (allowed.size > 0) {
    const cleared = await supabase
      .from("folder_items")
      .delete()
      .eq("media_item_id", media.ids[0])
      .in("folder_id", [...allowed])
    if (cleared.error) {
      if (missingFolderSchema(cleared.error.message)) {
        return { ok: false as const, status: 400, error: FOLDER_SCHEMA_MESSAGE }
      }
      return { ok: false as const, status: 502, error: "Could not update folders for that file." }
    }
  }
  if (chosen.length > 0) {
    const inserted = await supabase.from("folder_items").insert(
      chosen.map((folderId) => ({
        folder_id: folderId,
        media_item_id: media.ids[0],
      })),
    )
    if (inserted.error) {
      return { ok: false as const, status: 502, error: "Could not update folders for that file." }
    }
  }
  return { ok: true as const }
}
