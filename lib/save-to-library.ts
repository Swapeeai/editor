import {
  convertHeicToJpeg,
  HEIC_CONVERT_MESSAGE,
  HEIC_FAIL_MESSAGE,
  isHeicFile,
} from "@/lib/heic-photo"
import { uploadFileResumable } from "@/lib/tus-upload"
import { plainStorageError, RESUMABLE_AFTER_BYTES } from "@/lib/upload-limit"
import type { SavedMedia } from "@/lib/saved-media"

// Sends one file straight to Storage, then records the library row.
// The file does not pass through the Next.js server.

export async function saveFileToLibrary(
  file: File,
  projectId: string,
  onProgress?: (percent: number | null) => void,
  onStatus?: (detail: string) => void,
) {
  let ready = file
  let titleOverride: string | null = null
  if (isHeicFile(file)) {
    onStatus?.(HEIC_CONVERT_MESSAGE)
    try {
      ready = await convertHeicToJpeg(file)
      titleOverride = ready.name
    } catch {
      throw new Error(HEIC_FAIL_MESSAGE)
    }
  }
  onProgress?.(null)
  const durationSeconds = await videoDurationSeconds(ready)
  const preparedResponse = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      fileName: ready.name,
      mimeType: ready.type,
      size: ready.size,
    }),
  })
  const prepared = (await preparedResponse.json()) as {
    error?: string
    id?: string
    storagePath?: string
    signedUrl?: string
    token?: string
    resumableEndpoint?: string | null
    title?: string
  }
  if (!preparedResponse.ok || !prepared.signedUrl || !prepared.id || !prepared.storagePath) {
    throw new Error(prepared.error || "Could not start the upload.")
  }

  if (ready.size > RESUMABLE_AFTER_BYTES) {
    if (!prepared.token || !prepared.resumableEndpoint) {
      throw new Error("Could not start the large upload.")
    }
    await uploadFileResumable(
      prepared.resumableEndpoint,
      prepared.token,
      prepared.storagePath,
      ready,
      onProgress,
    )
  } else {
    await putFile(prepared.signedUrl, ready, onProgress)
  }

  const finishedResponse = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: prepared.id,
      projectId,
      fileName: ready.name,
      mimeType: ready.type,
      storagePath: prepared.storagePath,
      ...(titleOverride ? { title: titleOverride } : {}),
      ...(durationSeconds != null ? { durationSeconds } : {}),
    }),
  })
  const finished = (await finishedResponse.json()) as {
    error?: string
    item?: SavedMedia
  }
  if (!finishedResponse.ok) {
    throw new Error(finished.error || "Could not save that file.")
  }

  onProgress?.(100)
  return {
    title: finished.item?.title || titleOverride || prepared.title || ready.name,
    item: finished.item ?? null,
    fileName: ready.name,
    size: ready.size,
  }
}

function videoDurationSeconds(file: File) {
  const video =
    file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file.name)
  if (!video) {
    return Promise.resolve(null)
  }
  const url = URL.createObjectURL(file)
  return new Promise<number | null>((resolve) => {
    const element = document.createElement("video")
    element.preload = "metadata"
    element.onloadedmetadata = () => {
      const seconds = element.duration
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : null)
    }
    element.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    element.src = url
  })
}

function putFile(
  url: string,
  file: File,
  onProgress?: (percent: number | null) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData()
    body.append("cacheControl", "3600")
    body.append("", file, file.name)
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        onProgress?.(null)
        return
      }
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(
        new Error(
          plainStorageError(xhr.status, xhr.responseText) ||
            "Could not save the file to Storage. Nothing was added to the library.",
        ),
      )
    }
    xhr.onerror = () => {
      reject(new Error("Could not save the file to Storage. Check your connection, then try again."))
    }
    xhr.send(body)
  })
}
