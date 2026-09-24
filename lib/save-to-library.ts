import { plainStorageError } from "@/lib/upload-limit"

// Sends one file straight to Storage, then records the library row.
// The file does not pass through the Next.js server.

export async function saveFileToLibrary(file: File, projectId: string) {
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

  const uploadBody = new FormData()
  uploadBody.append("cacheControl", "3600")
  uploadBody.append("", file, file.name)
  const uploaded = await fetch(prepared.signedUrl, {
    method: "PUT",
    body: uploadBody,
  })
  if (!uploaded.ok) {
    const details = await uploaded.text()
    throw new Error(
      plainStorageError(uploaded.status, details) ||
        "Could not save the file to Storage. Nothing was added to the library.",
    )
  }

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
    item?: { title?: string }
  }
  if (!finishedResponse.ok) {
    throw new Error(finished.error || "Could not save that file.")
  }

  return { title: finished.item?.title || prepared.title || file.name }
}
