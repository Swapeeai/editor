// Supabase Free plan: 50 MB per file, about 1 GB for every file together.
// https://supabase.com/docs/guides/storage/uploads/file-limits
// The Next.js server used to read the whole file, and it only keeps the first
// 10 MB of a request. The browser now uploads straight to Storage instead.

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const FILE_TOO_BIG_MESSAGE =
  "This file is bigger than 50 MB. The free Supabase plan allows 50 MB per file, and about 1 GB for all files together. Shorten the video, or raise the file size limit in Supabase Storage settings on a paid plan."

export const STORAGE_FULL_MESSAGE =
  "Supabase storage is full. The free plan holds about 1 GB for all files together. Delete some files in Storage, or move to a paid plan."

export function plainStorageError(status: number, details: string) {
  const text = details.toLowerCase()
  if (
    status === 413 ||
    text.includes("maximum allowed size") ||
    text.includes("exceeded the maximum") ||
    text.includes("entity too large") ||
    text.includes("payload too large") ||
    text.includes("too large")
  ) {
    return FILE_TOO_BIG_MESSAGE
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
