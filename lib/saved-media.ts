import { projectById, type ProjectId } from "@/lib/projects"
import type { MediaType, SampleMedia } from "@/lib/sample-media"

export type IndexStatus = "pending" | "indexing" | "ready" | "failed"

export type SavedMedia = {
  id: string
  projectId: ProjectId
  title: string
  mediaType: MediaType
  storagePath: string
  mimeType: string | null
  createdAt: string
  signedUrl: string | null
  fileName: string
  indexStatus?: IndexStatus | null
  indexError?: string | null
  keywords?: string
  durationSeconds?: number | null
  folderNames?: string[]
  reviewedAt?: string | null
  sourceMediaId?: string | null
  sourceTitle?: string | null
}

export type MediaRow = {
  id: string
  project_id: string
  title: string
  media_type: string
  storage_path: string
  mime_type: string | null
  created_at: string
  twelvelabs_video_id?: string | null
  twelvelabs_asset_id?: string | null
  index_status?: string | null
  index_error?: string | null
  keywords?: string | null
  duration_seconds?: number | null
  reviewed_at?: string | null
  source_media_id?: string | null
  source_title?: string | null
}

export function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "file"
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
  return (cleaned || "file").slice(0, 80)
}

export function titleFromFileName(name: string) {
  const stem = safeFileName(name).replace(/\.[a-zA-Z0-9]+$/, "")
  const words = stem.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim()
  if (!words) {
    return "Untitled"
  }
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function mediaTypeFromFile(file: {
  type: string
  name: string
}): MediaType | null {
  if (file.type.startsWith("video/")) {
    return "video"
  }
  if (file.type.startsWith("image/")) {
    return "photo"
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
    return "video"
  }
  if (/\.(png|jpe?g|gif|webp|svg|heic|heif)$/i.test(file.name)) {
    return "photo"
  }
  return null
}

export function movedStoragePath(storagePath: string, projectId: ProjectId) {
  const parts = storagePath.split("/").filter(Boolean)
  if (parts.length < 2 || parts.some((part) => part === "." || part === "..")) {
    return null
  }
  parts[0] = projectId
  return parts.join("/")
}

export function formatSavedDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function fileNameFromStoragePath(storagePath: string) {
  const base = storagePath.split("/").pop() ?? storagePath
  return base.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    "",
  )
}

export function rowToSavedMedia(
  row: MediaRow,
  signedUrl: string | null,
): SavedMedia {
  return {
    id: row.id,
    projectId: row.project_id as ProjectId,
    title: row.title,
    mediaType: row.media_type === "photo" ? "photo" : "video",
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    signedUrl,
    fileName: fileNameFromStoragePath(row.storage_path),
    keywords: typeof row.keywords === "string" ? row.keywords : "",
    durationSeconds:
      typeof row.duration_seconds === "number" && row.duration_seconds > 0
        ? row.duration_seconds
        : null,
    folderNames: [],
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    sourceMediaId: typeof row.source_media_id === "string" ? row.source_media_id : null,
    sourceTitle: typeof row.source_title === "string" ? row.source_title : null,
    indexStatus:
      row.index_status === "pending" ||
      row.index_status === "indexing" ||
      row.index_status === "ready" ||
      row.index_status === "failed"
        ? row.index_status
        : null,
    indexError: typeof row.index_error === "string" ? row.index_error : null,
  }
}

// Turns a saved row into the shape findMoments already understands.
// Uploads have no tags yet, so title and fileName do the matching.
export function keywordTags(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function savedMediaAsClip(item: SavedMedia): SampleMedia {
  const project = projectById(item.projectId)
  const year = Number(String(item.createdAt).slice(0, 4))

  return {
    id: item.id,
    projectId: item.projectId,
    title: item.title,
    mediaType: item.mediaType,
    retreatName: project.name,
    year: Number.isFinite(year) && year > 0 ? year : new Date().getFullYear(),
    location: "Uploaded file",
    tags: [...keywordTags(item.keywords), ...(item.folderNames ?? [])],
    keywords: item.keywords ?? "",
    folderNames: item.folderNames ?? [],
    reviewedAt: item.reviewedAt ?? null,
    sourceMediaId: item.sourceMediaId ?? null,
    sourceTitle: item.sourceTitle ?? null,
    durationSeconds: item.durationSeconds ?? null,
    poster: item.mediaType === "photo" && item.signedUrl ? item.signedUrl : "",
    fileName: item.fileName,
    playbackUrl: item.signedUrl,
    createdAt: item.createdAt,
    indexStatus: item.indexStatus ?? null,
    indexError: item.indexError ?? null,
  }
}
