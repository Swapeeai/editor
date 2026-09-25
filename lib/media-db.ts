import "server-only"

import type { ProjectId } from "@/lib/projects"
import {
  rowToSavedMedia,
  type IndexStatus,
  type MediaRow,
  type SavedMedia,
} from "@/lib/saved-media"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const MEDIA_SELECT =
  "id, project_id, title, media_type, storage_path, mime_type, created_at"

export const MEDIA_SELECT_WITH_INDEX =
  `${MEDIA_SELECT}, twelvelabs_video_id, twelvelabs_asset_id, index_status, index_error`

export type LibraryItem = SavedMedia & {
  twelveLabsVideoId: string | null
  twelveLabsAssetId: string | null
}

export class IndexSchemaError extends Error {
  constructor() {
    super(
      "Run supabase/schema-twelvelabs.sql once in the Supabase SQL editor, then try again.",
    )
    this.name = "IndexSchemaError"
  }
}

export function isMissingIndexSchema(message: string) {
  return /twelvelabs_|index_status|index_error|schema cache|could not find the/i.test(
    message,
  )
}

function statusOf(value: unknown): IndexStatus | null {
  if (
    value === "pending" ||
    value === "indexing" ||
    value === "ready" ||
    value === "failed"
  ) {
    return value
  }
  return null
}

export function rowToLibraryItem(
  row: MediaRow,
  signedUrl: string | null,
): LibraryItem {
  return {
    ...rowToSavedMedia(row, signedUrl),
    indexStatus: statusOf(row.index_status),
    indexError: typeof row.index_error === "string" ? row.index_error : null,
    twelveLabsVideoId:
      typeof row.twelvelabs_video_id === "string" ? row.twelvelabs_video_id : null,
    twelveLabsAssetId:
      typeof row.twelvelabs_asset_id === "string" ? row.twelvelabs_asset_id : null,
  }
}

export function toPublicItem(item: LibraryItem): SavedMedia {
  return {
    id: item.id,
    projectId: item.projectId,
    title: item.title,
    mediaType: item.mediaType,
    storagePath: item.storagePath,
    mimeType: item.mimeType,
    createdAt: item.createdAt,
    signedUrl: item.signedUrl,
    fileName: item.fileName,
    indexStatus: item.indexStatus,
    indexError: item.indexError,
  }
}

async function signRows(
  rows: MediaRow[],
): Promise<LibraryItem[]> {
  const supabase = getSupabaseAdmin()
  const signedByPath = new Map<string, string>()
  if (supabase && rows.length > 0) {
    const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    )
    for (const entry of signed.data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedByPath.set(entry.path, entry.signedUrl)
      }
    }
  }
  return rows.map((row) =>
    rowToLibraryItem(row, signedByPath.get(row.storage_path) ?? null),
  )
}

export async function listProjectItems(projectId: ProjectId) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { indexSchema: false, items: [] as LibraryItem[] }
  }

  const withIndex = await supabase
    .from("media_items")
    .select(MEDIA_SELECT_WITH_INDEX)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (!withIndex.error) {
    return {
      indexSchema: true,
      items: await signRows((withIndex.data ?? []) as MediaRow[]),
    }
  }

  if (!isMissingIndexSchema(withIndex.error.message)) {
    throw new Error("Could not read the library. Check that you ran supabase/schema.sql.")
  }

  const plain = await supabase
    .from("media_items")
    .select(MEDIA_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (plain.error) {
    throw new Error("Could not read the library. Check that you ran supabase/schema.sql.")
  }

  return {
    indexSchema: false,
    items: await signRows((plain.data ?? []) as MediaRow[]),
  }
}

export async function readLibraryItem(id: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return null
  }
  const listed = await supabase
    .from("media_items")
    .select(MEDIA_SELECT_WITH_INDEX)
    .eq("id", id)
    .maybeSingle()

  if (listed.error) {
    if (isMissingIndexSchema(listed.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not read that file.")
  }
  if (!listed.data) {
    return null
  }
  const [item] = await signRows([listed.data as MediaRow])
  return item ?? null
}
