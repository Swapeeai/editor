import { mediaTypeFromFile } from "@/lib/saved-media"
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

export type DriveFileInfo = {
  id: string
  name: string
  mimeType: string
  size: number | null
}

export type ReadyDriveFile = {
  id: string
  name: string
  mimeType: string
  size: number
}

export type SkippedDriveFile = {
  name: string
  reason: string
}

export function bytesFromDriveSize(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

export function planDriveImport(files: DriveFileInfo[]) {
  const ready: ReadyDriveFile[] = []
  const skipped: SkippedDriveFile[] = []

  for (const file of files) {
    const name = file.name.trim() || "Untitled"
    if (!mediaTypeFromFile({ type: file.mimeType, name })) {
      skipped.push({
        name,
        reason: "It is not a video or a photo, so it was not downloaded.",
      })
      continue
    }
    if (file.size == null) {
      skipped.push({
        name,
        reason: "Google did not say how big it is, so it was not downloaded.",
      })
      continue
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      skipped.push({
        name,
        reason: "It is bigger than 50 MB, so it was not downloaded.",
      })
      continue
    }
    if (file.size <= 0) {
      skipped.push({
        name,
        reason: "Google said this file is empty, so it was not downloaded.",
      })
      continue
    }
    ready.push({
      id: file.id,
      name,
      mimeType: file.mimeType,
      size: file.size,
    })
  }

  return { ready, skipped }
}
