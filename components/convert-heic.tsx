"use client"

import { useMemo, useState } from "react"
import { FileQueue, type QueueItem } from "@/components/file-queue"
import { Button } from "@/components/ui/button"
import {
  convertHeicToJpeg,
  HEIC_CONVERT_MESSAGE,
  HEIC_FAIL_MESSAGE,
  isStoredHeic,
  jpegTitleForStored,
} from "@/lib/heic-photo"
import { uploadFileResumable } from "@/lib/tus-upload"
import { plainStorageError, RESUMABLE_AFTER_BYTES } from "@/lib/upload-limit"
import { runPool } from "@/lib/run-pool"
import type { SavedMedia } from "@/lib/saved-media"

const CONVERT_AT_ONCE = 3

export function ConvertHeic({
  projectId,
  items,
  onChanged,
}: {
  projectId: string
  items: SavedMedia[]
  onChanged: () => void
}) {
  const heicItems = useMemo(() => items.filter(isStoredHeic), [items])
  const [running, setRunning] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  function patch(id: string, next: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...next } : entry)),
    )
  }

  async function convertOne(item: SavedMedia, entryId: string) {
    patch(entryId, { status: "uploading", percent: null, detail: HEIC_CONVERT_MESSAGE })
    const started = await fetch("/api/media/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", id: item.id, projectId }),
    })
    const startBody = (await started.json()) as {
      error?: string
      downloadUrl?: string
      storagePath?: string
      fileName?: string
      title?: string
      signedUrl?: string
      token?: string
      resumableEndpoint?: string | null
    }
    if (!started.ok || !startBody.downloadUrl || !startBody.signedUrl || !startBody.storagePath) {
      throw new Error(startBody.error || HEIC_FAIL_MESSAGE)
    }

    const downloaded = await fetch(startBody.downloadUrl)
    if (!downloaded.ok) {
      throw new Error(HEIC_FAIL_MESSAGE)
    }
    const sourceName = item.fileName || item.title || "photo.heic"
    const source = new File([await downloaded.blob()], sourceName, {
      type: item.mimeType || "image/heic",
    })
    let jpeg: File
    try {
      jpeg = await convertHeicToJpeg(source)
    } catch {
      throw new Error(HEIC_FAIL_MESSAGE)
    }

    patch(entryId, { detail: "Saving the JPEG…", percent: null })
    if (jpeg.size > RESUMABLE_AFTER_BYTES) {
      if (!startBody.token || !startBody.resumableEndpoint) {
        throw new Error("Could not start saving the JPEG.")
      }
      await uploadFileResumable(
        startBody.resumableEndpoint,
        startBody.token,
        startBody.storagePath,
        jpeg,
        (percent) => patch(entryId, { percent }),
      )
    } else {
      await putJpeg(startBody.signedUrl, jpeg, (percent) => patch(entryId, { percent }))
    }

    const finished = await fetch("/api/media/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "finish",
        id: item.id,
        projectId,
        storagePath: startBody.storagePath,
      }),
    })
    const finishBody = (await finished.json()) as { error?: string; title?: string }
    if (!finished.ok) {
      throw new Error(finishBody.error || "Could not update that photo.")
    }
    patch(entryId, {
      status: "done",
      percent: 100,
      detail: `Saved as ${finishBody.title || startBody.title || jpegTitleForStored(item)}`,
    })
  }

  async function convertAll() {
    if (running) {
      return
    }
    if (heicItems.length === 0) {
      setSummary("No iPhone photos need converting.")
      setQueue([])
      return
    }
    setRunning(true)
    setSummary(null)
    const entries: QueueItem[] = heicItems.map((item) => ({
      id: item.id,
      name: item.title || item.fileName,
      size: null,
      status: "waiting",
      percent: null,
      detail: "Waiting",
    }))
    setQueue(entries)
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", leave)
    let failed = 0
    let saved = 0
    try {
      await runPool(heicItems, CONVERT_AT_ONCE, async (item) => {
        try {
          await convertOne(item, item.id)
          saved += 1
        } catch (error) {
          failed += 1
          patch(item.id, {
            status: "failed",
            percent: null,
            detail: error instanceof Error ? error.message : HEIC_FAIL_MESSAGE,
          })
        }
      })
      if (failed === 0) {
        setSummary(
          saved === 1
            ? "Converted 1 iPhone photo to JPEG."
            : `Converted ${saved} iPhone photos to JPEG.`,
        )
      } else {
        setSummary(`Converted ${saved}. ${failed} could not be converted.`)
      }
      onChanged()
    } finally {
      window.removeEventListener("beforeunload", leave)
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Button type="button" variant="outline" onClick={() => void convertAll()} disabled={running}>
        {running ? "Converting iPhone photos…" : "Convert iPhone photos to JPEG"}
      </Button>
      {heicItems.length > 0 && !running && queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {heicItems.length === 1
            ? "1 iPhone photo in this project can be converted."
            : `${heicItems.length} iPhone photos in this project can be converted.`}
        </p>
      ) : null}
      {summary ? (
        <p className="text-sm text-muted-foreground" role="status">
          {summary}
        </p>
      ) : null}
      <FileQueue items={queue} doneLabel="converted" />
    </div>
  )
}

function putJpeg(
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
            "Could not save the JPEG. The original iPhone photo is unchanged.",
        ),
      )
    }
    xhr.onerror = () => {
      reject(new Error("Could not save the JPEG. Check your connection, then try again."))
    }
    xhr.send(body)
  })
}
