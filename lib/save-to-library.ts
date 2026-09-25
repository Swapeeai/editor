import { plainStorageError } from "@/lib/upload-limit"
import type { SavedMedia } from "@/lib/saved-media"

// Sends one file straight to Storage, then records the library row.
// The file does not pass through the Next.js server.

export async function saveFileToLibrary(
  file: File,
  projectId: string,
  onProgress?: (percent: number | null) => void,
) {
  onProgress?.(null)
  const preparedResponse = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  })
  const prepared = (await preparedResponse.json()) as {
    error?: string
    id?: string
    storagePath?: string
    signedUrl?: string
    title?: string
  }
  if (!preparedResponse.ok || !prepared.signedUrl || !prepared.id || !prepared.storagePath) {
    throw new Error(prepared.error || "Could not start the upload.")
  }

  await putFile(prepared.signedUrl, file, onProgress)

  const finishedResponse = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: prepared.id,
      projectId,
      fileName: file.name,
      mimeType: file.type,
      storagePath: prepared.storagePath,
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
    title: finished.item?.title || prepared.title || file.name,
    item: finished.item ?? null,
  }
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
