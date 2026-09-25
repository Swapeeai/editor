// Google Photos Picker API (photospicker.googleapis.com).
// The old Photos Library API no longer covers the user's own library.
// Docs checked September 2026: sessions, mediaItems.list, baseUrl =d / =dv.

export const PHOTOS_SCOPE = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly"
export const PHOTOS_API = "https://photospicker.googleapis.com/v1"

export const PHOTOS_SETUP_NOTE =
  "In Google Cloud, open APIs & Services, then Library. Search for Photos Picker API and click Enable. Then open Google Auth platform, then Data Access, then Add or remove scopes, and add https://www.googleapis.com/auth/photospicker.mediaitems.readonly. Click Update, then Save. Come back here, click Import from Google Photos, and sign in again."

export type PhotosMediaItem = {
  id?: string
  type?: string
  mediaFile?: {
    baseUrl?: string
    mimeType?: string
    filename?: string
    mediaFileMetadata?: {
      videoMetadata?: { processingStatus?: string }
    }
  }
  mediaMetadata?: {
    status?: string
    video?: { status?: string }
  }
}

export function durationMs(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value >= 1000 ? value : Math.round(value * 1000)
  }
  if (typeof value !== "string") {
    return fallback
  }
  const match = value.trim().match(/^(\d+(?:\.\d+)?)s$/)
  if (!match) {
    return fallback
  }
  return Math.round(Number(match[1]) * 1000)
}

export function isVideoItem(item: PhotosMediaItem) {
  if (item.type === "VIDEO") {
    return true
  }
  return (item.mediaFile?.mimeType ?? "").startsWith("video/")
}

// Current Picker responses use mediaFile.mediaFileMetadata.videoMetadata.processingStatus.
// The download guide still says mediaMetadata.video.status. Either READY is accepted.
export function videoStatus(item: PhotosMediaItem) {
  return (
    item.mediaFile?.mediaFileMetadata?.videoMetadata?.processingStatus ||
    item.mediaMetadata?.video?.status ||
    item.mediaMetadata?.status ||
    ""
  )
}

export function videoSkipReason(item: PhotosMediaItem) {
  if (!isVideoItem(item)) {
    return null
  }
  const status = videoStatus(item)
  if (status === "READY") {
    return null
  }
  if (status === "FAILED") {
    return "Google Photos could not prepare this video, so it was not downloaded."
  }
  return "This video is not ready in Google Photos yet, so it was not downloaded."
}

export function photosContentUrl(item: PhotosMediaItem) {
  const base = item.mediaFile?.baseUrl?.trim() ?? ""
  if (!base) {
    return ""
  }
  const suffix = isVideoItem(item) ? "=dv" : "=d"
  if (/=d$|=dv$|=w|=h/.test(base)) {
    return base
  }
  return `${base}${suffix}`
}

export function withAutoclose(pickerUri: string) {
  const url = new URL(pickerUri)
  const path = url.pathname.replace(/\/$/, "")
  if (!path.endsWith("/autoclose")) {
    url.pathname = `${path}/autoclose`
  }
  return url.toString()
}

export function plainPhotosFailure(status: number, body: string) {
  if (status === 401) {
    return "Google sign-in expired. Click Import from Google Photos and sign in again."
  }
  if (
    status === 403 ||
    /SERVICE_DISABLED|has not been used|Photos Picker API|accessNotConfigured|PERMISSION_DENIED|API has not been used|insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(
      body,
    )
  ) {
    return PHOTOS_SETUP_NOTE
  }
  return "Could not open Google Photos. Try the button again."
}
