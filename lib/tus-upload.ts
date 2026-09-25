import { plainStorageError, TUS_CHUNK_BYTES } from "@/lib/upload-limit"

// Sends one large file straight to Supabase Storage with resumable chunks.
// The file is not read into the Next.js server. Chunks are 6 MB, which
// Supabase requires for TUS.

function bytesToBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function encodeMetadata(entries: Record<string, string>) {
  return Object.entries(entries)
    .map(([key, value]) => `${key} ${bytesToBase64(value)}`)
    .join(",")
}

function storageMessage(status: number, body: string) {
  return (
    plainStorageError(status, body) ||
    "Could not save the file to Storage. Nothing was added to the library."
  )
}

async function createUpload(
  endpoint: string,
  token: string,
  file: File,
  objectName: string,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(file.size),
      "Upload-Metadata": encodeMetadata({
        bucketName: "media",
        objectName,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      }),
      "x-signature": token,
    },
  })
  if (!response.ok) {
    throw new Error(storageMessage(response.status, await response.text()))
  }
  const location = response.headers.get("Location")
  if (!location) {
    throw new Error("Could not start the large upload.")
  }
  return new URL(location, endpoint).toString()
}

function patchChunk(
  url: string,
  token: string,
  blob: Blob,
  offset: number,
  onLoaded: (loaded: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PATCH", url)
    xhr.setRequestHeader("Tus-Resumable", "1.0.0")
    xhr.setRequestHeader("Upload-Offset", String(offset))
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream")
    xhr.setRequestHeader("x-signature", token)
    xhr.upload.onprogress = (event) => {
      onLoaded(event.loaded)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      const error = new Error(storageMessage(xhr.status, xhr.responseText))
      ;(error as Error & { status?: number }).status = xhr.status
      reject(error)
    }
    xhr.onerror = () => {
      reject(new Error("Could not save the file to Storage. Check your connection, then try again."))
    }
    xhr.send(blob)
  })
}

async function readOffset(url: string, token: string) {
  const response = await fetch(url, {
    method: "HEAD",
    headers: {
      "Tus-Resumable": "1.0.0",
      "x-signature": token,
    },
  })
  if (!response.ok) {
    return null
  }
  const offset = Number(response.headers.get("Upload-Offset"))
  return Number.isFinite(offset) ? offset : null
}

export async function uploadFileResumable(
  endpoint: string,
  token: string,
  objectName: string,
  file: File,
  onProgress?: (percent: number | null) => void,
) {
  const location = await createUpload(endpoint, token, file, objectName)
  let offset = 0
  while (offset < file.size) {
    const end = Math.min(file.size, offset + TUS_CHUNK_BYTES)
    const chunk = file.slice(offset, end)
    const start = offset
    let sent = false
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3 && !sent; attempt += 1) {
      try {
        await patchChunk(location, token, chunk, start, (loaded) => {
          const done = Math.min(file.size, start + loaded)
          onProgress?.(Math.min(99, Math.round((done / file.size) * 100)))
        })
        sent = true
      } catch (caught) {
        lastError = caught instanceof Error ? caught : new Error("Could not save the file to Storage.")
        const status = (caught as { status?: number }).status
        if (status === 409 || status === 0) {
          const remote = await readOffset(location, token)
          if (remote != null && remote > start && remote <= file.size) {
            offset = remote
            sent = true
            break
          }
        }
        if (plainStorageError(status ?? 0, lastError.message)) {
          throw lastError
        }
      }
    }
    if (!sent) {
      throw lastError ?? new Error("Could not save the file to Storage.")
    }
    if (offset === start) {
      offset = end
    }
  }
}
