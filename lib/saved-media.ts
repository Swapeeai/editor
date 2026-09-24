import { projectById, type ProjectId } from "@/lib/projects"
import type { MediaType, SampleMedia } from "@/lib/sample-media"

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
}

export type MediaRow = {
  id: string
  project_id: string
  title: string
  media_type: string
  storage_path: string
  mime_type: string | null
  created_at: string
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
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
    return "photo"
  }
  return null
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
  }
}

// Turns a saved row into the shape findMoments already understands.
// Uploads have no tags yet, so title and fileName do the matching.
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
    tags: [],
    poster: item.mediaType === "photo" && item.signedUrl ? item.signedUrl : "",
    fileName: item.fileName,
    playbackUrl: item.signedUrl,
  }
}
