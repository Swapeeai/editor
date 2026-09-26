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

const MEDIA_SELECT_FULL = `${MEDIA_SELECT_WITH_INDEX}, keywords, duration_seconds`
const MEDIA_SELECT_REVIEWED = `${MEDIA_SELECT_FULL}, reviewed_at`
const MEDIA_SELECT_SOURCE = `${MEDIA_SELECT_REVIEWED}, source_media_id, source_title`
const MEDIA_SELECT_THUMB = `${MEDIA_SELECT_SOURCE}, thumbnail_path`
const MEDIA_SELECT_KEYWORDS = `${MEDIA_SELECT}, keywords`

export type LibraryFolder = {
  id: string
  projectId: ProjectId
  name: string
  count: number
}

export type LibraryItem = SavedMedia & {
  twelveLabsVideoId: string | null
  twelveLabsAssetId: string | null
}

export class IndexSchemaError extends Error {
  constructor() {
    super(
      "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again.",
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
    keywords: item.keywords ?? "",
    durationSeconds: item.durationSeconds ?? null,
    folderNames: item.folderNames ?? [],
    reviewedAt: item.reviewedAt ?? null,
    sourceMediaId: item.sourceMediaId ?? null,
    sourceTitle: item.sourceTitle ?? null,
    thumbnailPath: item.thumbnailPath ?? null,
    thumbnailUrl: item.thumbnailUrl ?? null,
  }
}

export type ApprovedSegment = {
  id: string
  mediaItemId: string
  projectId: ProjectId
  startSeconds: number
  endSeconds: number | null
  label: string | null
}

async function signRows(
  rows: MediaRow[],
): Promise<LibraryItem[]> {
  const supabase = getSupabaseAdmin()
  const signedByPath = new Map<string, string>()
  if (supabase && rows.length > 0) {
    const paths = [
      ...rows.map((row) => row.storage_path),
      ...rows.flatMap((row) =>
        typeof row.thumbnail_path === "string" && row.thumbnail_path ? [row.thumbnail_path] : [],
      ),
    ]
    const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60)
    for (const entry of signed.data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedByPath.set(entry.path, entry.signedUrl)
      }
    }
  }
  return rows.map((row) => {
    const item = rowToLibraryItem(row, signedByPath.get(row.storage_path) ?? null)
    const thumb = typeof row.thumbnail_path === "string" ? row.thumbnail_path : ""
    item.thumbnailPath = thumb || null
    item.thumbnailUrl = thumb ? (signedByPath.get(thumb) ?? null) : null
    return item
  })
}

function missingColumn(message: string) {
  return /schema cache|could not find the|column/i.test(message)
}

async function attachFolders(projectId: ProjectId, items: LibraryItem[]) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { foldersSchema: false, folders: [] as LibraryFolder[], items }
  }

  const listed = await supabase
    .from("folders")
    .select("id, name")
    .eq("project_id", projectId)
    .order("name", { ascending: true })
  if (listed.error) {
    if (missingColumn(listed.error.message) || /folders/i.test(listed.error.message)) {
      return { foldersSchema: false, folders: [] as LibraryFolder[], items }
    }
    throw new Error("Could not read folders.")
  }

  const folders = (listed.data ?? []) as { id?: unknown; name?: unknown }[]
  const named = folders.flatMap((row) =>
    typeof row.id === "string" && typeof row.name === "string"
      ? [{ id: row.id, name: row.name }]
      : [],
  )
  const namesByItem = new Map<string, string[]>()
  const counts = new Map<string, number>()
  if (named.length > 0) {
    const links = await supabase
      .from("folder_items")
      .select("folder_id, media_item_id")
      .in(
        "folder_id",
        named.map((folder) => folder.id),
      )
    if (links.error) {
      if (missingColumn(links.error.message) || /folder_items/i.test(links.error.message)) {
        return { foldersSchema: false, folders: [] as LibraryFolder[], items }
      }
      throw new Error("Could not read folder contents.")
    }
    const nameOf = new Map(named.map((folder) => [folder.id, folder.name]))
    for (const row of links.data ?? []) {
      const record = row as { folder_id?: unknown; media_item_id?: unknown }
      if (typeof record.folder_id !== "string" || typeof record.media_item_id !== "string") {
        continue
      }
      const name = nameOf.get(record.folder_id)
      if (!name) {
        continue
      }
      const list = namesByItem.get(record.media_item_id) ?? []
      list.push(name)
      namesByItem.set(record.media_item_id, list)
      counts.set(record.folder_id, (counts.get(record.folder_id) ?? 0) + 1)
    }
  }

  return {
    foldersSchema: true,
    folders: named.map((folder) => ({
      id: folder.id,
      projectId,
      name: folder.name,
      count: counts.get(folder.id) ?? 0,
    })),
    items: items.map((item) => ({
      ...item,
      folderNames: namesByItem.get(item.id) ?? [],
    })),
  }
}

export async function listProjectItems(projectId: ProjectId) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return {
      indexSchema: false,
      keywordsSchema: false,
      reviewedSchema: false,
      foldersSchema: false,
      thumbnailSchema: false,
      folders: [] as LibraryFolder[],
      items: [] as LibraryItem[],
    }
  }

  const attempts = [
    { select: MEDIA_SELECT_THUMB, indexSchema: true, keywordsSchema: true, reviewedSchema: true, thumbnailSchema: true },
    { select: MEDIA_SELECT_SOURCE, indexSchema: true, keywordsSchema: true, reviewedSchema: true, thumbnailSchema: false },
    { select: MEDIA_SELECT_REVIEWED, indexSchema: true, keywordsSchema: true, reviewedSchema: true, thumbnailSchema: false },
    { select: MEDIA_SELECT_FULL, indexSchema: true, keywordsSchema: true, reviewedSchema: false, thumbnailSchema: false },
    { select: MEDIA_SELECT_WITH_INDEX, indexSchema: true, keywordsSchema: false, reviewedSchema: false, thumbnailSchema: false },
    { select: MEDIA_SELECT_KEYWORDS, indexSchema: false, keywordsSchema: true, reviewedSchema: false, thumbnailSchema: false },
    { select: MEDIA_SELECT, indexSchema: false, keywordsSchema: false, reviewedSchema: false, thumbnailSchema: false },
  ]

  let lastMessage = ""
  for (const attempt of attempts) {
    const listed = await supabase
      .from("media_items")
      .select(attempt.select)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
    if (!listed.error) {
      const signed = await signRows((listed.data ?? []) as unknown as MediaRow[])
      const withFolders = await attachFolders(projectId, signed)
      return {
        indexSchema: attempt.indexSchema,
        keywordsSchema: attempt.keywordsSchema,
        reviewedSchema: attempt.reviewedSchema,
        foldersSchema: withFolders.foldersSchema,
        thumbnailSchema: attempt.thumbnailSchema,
        folders: withFolders.folders,
        items: withFolders.items,
      }
    }
    lastMessage = listed.error.message
    if (!missingColumn(lastMessage) && !isMissingIndexSchema(lastMessage)) {
      throw new Error("Could not read the library. Check that you ran supabase/schema.sql.")
    }
  }

  throw new Error(
    lastMessage || "Could not read the library. Check that you ran supabase/schema.sql.",
  )
}

export async function listApprovedSegments(projectId: ProjectId) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ready: false, segments: [] as ApprovedSegment[] }
  }
  const listed = await supabase
    .from("approved_segments")
    .select("id, media_item_id, project_id, start_seconds, end_seconds, label")
    .eq("project_id", projectId)
    .order("start_seconds", { ascending: true })
  if (listed.error) {
    if (missingColumn(listed.error.message) || /approved_segments/i.test(listed.error.message)) {
      return { ready: false, segments: [] as ApprovedSegment[] }
    }
    throw new Error("Could not read the approved moments.")
  }
  const segments: ApprovedSegment[] = []
  for (const row of listed.data ?? []) {
    const record = row as {
      id?: unknown
      media_item_id?: unknown
      start_seconds?: unknown
      end_seconds?: unknown
      label?: unknown
    }
    if (typeof record.id !== "string" || typeof record.media_item_id !== "string") {
      continue
    }
    const start = typeof record.start_seconds === "number" ? record.start_seconds : Number.NaN
    if (!Number.isFinite(start) || start < 0) {
      continue
    }
    const end =
      typeof record.end_seconds === "number" && record.end_seconds > start
        ? record.end_seconds
        : null
    segments.push({
      id: record.id,
      mediaItemId: record.media_item_id,
      projectId,
      startSeconds: start,
      endSeconds: end,
      label: typeof record.label === "string" ? record.label : null,
    })
  }
  return { ready: true, segments }
}

export async function readLibraryItem(id: string) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return null
  }
  const withDuration = await supabase
    .from("media_items")
    .select(`${MEDIA_SELECT_WITH_INDEX}, duration_seconds`)
    .eq("id", id)
    .maybeSingle()
  const listed = withDuration.error
    ? await supabase
        .from("media_items")
        .select(MEDIA_SELECT_WITH_INDEX)
        .eq("id", id)
        .maybeSingle()
    : withDuration

  if (listed.error) {
    if (isMissingIndexSchema(listed.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not read that file.")
  }
  if (!listed.data) {
    return null
  }
  const [item] = await signRows([listed.data as unknown as MediaRow])
  return item ?? null
}
