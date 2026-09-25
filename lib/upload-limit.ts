// NEXT_PUBLIC_MAX_UPLOAD_MB is the largest file this app will try to upload.
// It defaults to 5000 (5 GB). It must not be higher than the Supabase project's
// global file size limit (Storage settings). The browser uploads straight to
// Storage. Files over 6 MB use resumable upload, which Supabase recommends
// above that size. Standard uploads can reach 5 GB; resumable can go higher
// when the project limit allows it.
// https://supabase.com/docs/guides/storage/uploads/resumable-uploads

const DEFAULT_MAX_UPLOAD_MB = 5000

function readMaxUploadMb() {
  const raw = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB?.trim() ?? ""
  if (!raw) {
    return DEFAULT_MAX_UPLOAD_MB
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_MB
  }
  return parsed
}

export const MAX_UPLOAD_MB = readMaxUploadMb()

export const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024)

/** Supabase recommends resumable (TUS) uploads above 6 MB. */
export const RESUMABLE_AFTER_BYTES = 6 * 1024 * 1024

export const TUS_CHUNK_BYTES = 6 * 1024 * 1024

export function maxUploadBytes() {
  return Math.floor(readMaxUploadMb() * 1024 * 1024)
}

export function formatUploadLimit(mb = readMaxUploadMb()) {
  if (mb >= 1000 && mb % 1000 === 0) {
    const gb = mb / 1000
    return gb === 1 ? "1 GB" : `${gb} GB`
  }
  if (Number.isInteger(mb)) {
    return `${mb} MB`
  }
  return `${mb} MB`
}

export function fileTooBigMessage(kind: "saved" | "downloaded" = "saved") {
  const limit = formatUploadLimit()
  if (kind === "downloaded") {
    return `It is bigger than ${limit}, so it was not downloaded.`
  }
  return `This file is bigger than ${limit}, so it was not saved.`
}

export const FILE_TOO_BIG_MESSAGE = fileTooBigMessage("saved")

export const PROJECT_FILE_LIMIT_MESSAGE =
  "This file is bigger than this Supabase project allows. In the Supabase dashboard, open Storage settings and raise the global file size limit, then try again."

export const STORAGE_FULL_MESSAGE =
  "Supabase storage is full. Delete some files in Storage, or raise the storage quota on your plan."

export function plainStorageError(status: number, details: string) {
  const text = details.toLowerCase()
  if (
    status === 413 ||
    text.includes("maximum allowed size") ||
    text.includes("exceeded the maximum") ||
    text.includes("entity too large") ||
    text.includes("payload too large") ||
    text.includes("file size limit") ||
    text.includes("maximum size") ||
    text.includes("too large")
  ) {
    return PROJECT_FILE_LIMIT_MESSAGE
  }
  if (
    text.includes("quota") ||
    text.includes("storage limit") ||
    text.includes("exceeded the quota")
  ) {
    return STORAGE_FULL_MESSAGE
  }
  return null
}

export function resumableUploadEndpoint() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  if (!raw) {
    return null
  }
  try {
    const url = new URL(raw)
    const ref = url.hostname.split(".")[0]
    if (!ref) {
      return null
    }
    return `https://${ref}.storage.supabase.co/storage/v1/upload/resumable/sign`
  } catch {
    return null
  }
}
