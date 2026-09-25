"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { BatchSummary, FileQueue, savedDetail, type QueueItem } from "@/components/file-queue"
import { useLeaveGuard } from "@/components/use-leave-guard"
import { useProject } from "@/components/project-provider"
import {
  PHOTOS_API,
  PHOTOS_SCOPE,
  PHOTOS_SETUP_NOTE,
  durationMs,
  photosContentUrl,
  plainPhotosFailure,
  videoSkipReason,
  withAutoclose,
  type PhotosMediaItem,
} from "@/lib/photos-picker"
import { runPool, UPLOAD_CONCURRENCY } from "@/lib/run-pool"
import { HEIC_CONVERT_MESSAGE, isHeicFile } from "@/lib/heic-photo"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { fileTooBigMessage, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"
import { projectById, type ProjectId } from "@/lib/projects"

type ImportRow = QueueItem

type TokenClient = {
  callback: (response: { error?: string; access_token?: string }) => void
  requestAccessToken: (options: { prompt: string }) => void
}

function clientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
}

function loadGis() {
  const src = "https://accounts.google.com/gsi/client"
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      const wait = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(wait)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(wait)
        resolve()
      }, 8000)
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Could not load Google. Check your internet connection."))
    document.head.appendChild(script)
  })
}

async function readGoogleError(response: Response) {
  const status = response.status
  let body = ""
  try {
    body = await response.text()
  } catch {
    body = ""
  }
  return plainPhotosFailure(status, body)
}

async function photosFetch(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    throw new Error(await readGoogleError(response))
  }
  return response
}

function sleep(ms: number, cancelled: () => boolean) {
  return new Promise<void>((resolve) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (cancelled() || Date.now() - start >= ms) {
        clearInterval(timer)
        resolve()
      }
    }, 200)
  })
}

async function readUpTo(response: Response, maxBytes: number) {
  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    if (blob.size > maxBytes) {
      return { tooBig: true as const }
    }
    return { tooBig: false as const, bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type }
  }
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return { tooBig: true as const }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { tooBig: false as const, bytes, type: response.headers.get("content-type") ?? "" }
}

export function PhotosImport({ connected }: { connected: boolean }) {
  const { project } = useProject()
  const id = clientId()
  const tokenClientRef = useRef<TokenClient | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const cancelRef = useRef(false)
  const rowsRef = useRef<ImportRow[]>([])
  const itemsRef = useRef(new Map<string, PhotosMediaItem>())
  const batchProjectRef = useRef<ProjectId>(project.id)
  const [batchProjectId, setBatchProjectId] = useState<ProjectId>(project.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pickerLink, setPickerLink] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [showSummary, setShowSummary] = useState(false)

  useLeaveGuard(rows.some((row) => row.status === "uploading"))

  function commit(next: ImportRow[]) {
    rowsRef.current = next
    setRows(next)
  }

  function updateRow(rowId: string, patch: Partial<ImportRow>) {
    commit(rowsRef.current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id)
    if (!row || row.status === "uploading") {
      return
    }
    commit(rowsRef.current.filter((item) => item.id !== id))
  }

  async function savePhoto(token: string, item: PhotosMediaItem, projectId: ProjectId, projectName: string) {
    const rowId = item.id || ""
    const name = item.mediaFile?.filename?.trim() || "Google Photos item"
    const row = rowsRef.current.find((entry) => entry.id === rowId)
    if (!rowId || !row || row.status !== "waiting") {
      return
    }
    if (cancelRef.current) {
      updateRow(rowId, { status: "skipped", detail: "Cancelled" })
      return
    }
    const url = photosContentUrl(item)
    if (!url) {
      updateRow(rowId, { status: "failed", detail: "Google did not give a download link." })
      return
    }
    updateRow(rowId, { status: "uploading", percent: null, detail: "Downloading from Google Photos" })
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) {
        throw new Error(await readGoogleError(response))
      }
      const lengthHeader = Number(response.headers.get("content-length"))
      if (Number.isFinite(lengthHeader) && lengthHeader > MAX_UPLOAD_BYTES) {
        await response.body?.cancel()
        updateRow(rowId, {
          status: "skipped",
          size: lengthHeader,
          detail: fileTooBigMessage("downloaded"),
        })
        return
      }
      const downloaded = await readUpTo(response, MAX_UPLOAD_BYTES)
      if (downloaded.tooBig) {
        updateRow(rowId, {
          status: "skipped",
          detail: fileTooBigMessage("saved"),
        })
        return
      }
      const mimeType = item.mediaFile?.mimeType || downloaded.type || "application/octet-stream"
      const file = new File([downloaded.bytes], name, { type: mimeType })
      updateRow(rowId, {
        size: file.size,
        detail: isHeicFile(file) ? HEIC_CONVERT_MESSAGE : `Saving to ${projectName}`,
      })
      const saved = await saveFileToLibrary(
        file,
        projectId,
        (percent) => {
          updateRow(rowId, {
            percent,
            detail: percent == null ? `Saving to ${projectName}` : `Uploading ${percent}%`,
          })
        },
        (detail) => {
          updateRow(rowId, { detail, percent: null })
        },
      )
      updateRow(rowId, {
        name: saved.fileName,
        size: saved.size,
        status: "done",
        percent: 100,
        detail: savedDetail(saved),
      })
    } catch (caught) {
      updateRow(rowId, {
        status: "failed",
        percent: null,
        detail: caught instanceof Error ? caught.message : "Could not import this file.",
      })
    }
  }

  async function importItems(token: string, items: PhotosMediaItem[]) {
    itemsRef.current = new Map()
    const starting: ImportRow[] = items.map((item, index) => {
      const id = item.id || `photo-${index}`
      const name = item.mediaFile?.filename?.trim() || "Google Photos item"
      if (item.id) {
        itemsRef.current.set(id, item)
      }
      const notReady = item.id ? videoSkipReason(item) : null
      if (!item.id) {
        return { id, name, size: null, status: "failed" as const, percent: null, detail: "Google did not give an id." }
      }
      if (notReady) {
        return { id, name, size: null, status: "skipped" as const, percent: null, detail: notReady }
      }
      if (!photosContentUrl(item)) {
        return {
          id,
          name,
          size: null,
          status: "failed" as const,
          percent: null,
          detail: "Google did not give a download link.",
        }
      }
      return { id, name, size: null, status: "waiting" as const, percent: null, detail: "Waiting" }
    })
    commit(starting)
    setShowSummary(false)
    const projectId = project.id
    const projectName = project.name
    batchProjectRef.current = projectId
    setBatchProjectId(projectId)
    await runPool(
      starting.filter((row) => row.status === "waiting").map((row) => row.id),
      UPLOAD_CONCURRENCY,
      async (id) => {
        const item = itemsRef.current.get(id)
        if (!item) {
          return
        }
        await savePhoto(token, item, projectId, projectName)
      },
    )
    setShowSummary(true)
  }

  async function runSession(token: string) {
    type PickingSession = {
      id?: string
      pickerUri?: string
      mediaItemsSet?: boolean
      pollingConfig?: { pollInterval?: string; timeoutIn?: string }
    }
    const created = await photosFetch(token, `${PHOTOS_API}/sessions`, {
      method: "POST",
      body: "{}",
    })
    const session = (await created.json()) as PickingSession
    const sessionId = session.id ?? ""
    const pickerUri = session.pickerUri ?? ""
    if (!sessionId || !pickerUri) {
      throw new Error("Could not open Google Photos. Try the button again.")
    }
    try {
      const openUrl = withAutoclose(pickerUri)
      const popup = window.open(openUrl, "_blank")
      if (!popup) {
        setPickerLink(openUrl)
      }
      setStatus("Choose the photos and videos in the Google Photos window. This page waits until you are done.")

      const started = Date.now()
      let timeoutMs = durationMs(session.pollingConfig?.timeoutIn, 10 * 60 * 1000)
      let pollMs = durationMs(session.pollingConfig?.pollInterval, 2000)
      let current = session
      while (!cancelRef.current && !current.mediaItemsSet) {
        if (timeoutMs === 0 || Date.now() - started >= timeoutMs) {
          throw new Error("Google Photos timed out before you finished choosing. Try the button again.")
        }
        await sleep(Math.min(30_000, Math.max(1000, pollMs)), () => cancelRef.current)
        if (cancelRef.current) {
          return
        }
        const polled = await photosFetch(token, `${PHOTOS_API}/sessions/${encodeURIComponent(sessionId)}`)
        current = (await polled.json()) as PickingSession
        if (current.pollingConfig?.pollInterval) {
          pollMs = durationMs(current.pollingConfig.pollInterval, pollMs)
        }
        if (current.pollingConfig?.timeoutIn) {
          timeoutMs = durationMs(current.pollingConfig.timeoutIn, timeoutMs)
        }
      }
      if (cancelRef.current || !current.mediaItemsSet) {
        return
      }

      setStatus("Copying the files you chose…")
      setPickerLink(null)
      const items: PhotosMediaItem[] = []
      let pageToken = ""
      do {
        const url = new URL(`${PHOTOS_API}/mediaItems`)
        url.searchParams.set("sessionId", sessionId)
        url.searchParams.set("pageSize", "100")
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken)
        }
        const listed = await photosFetch(token, url.toString())
        const body = (await listed.json()) as {
          mediaItems?: PhotosMediaItem[]
          nextPageToken?: string
        }
        items.push(...(body.mediaItems ?? []))
        pageToken = body.nextPageToken ?? ""
      } while (pageToken)

      if (items.length === 0) {
        setShowSummary(false)
        setError("You did not choose any files.")
        return
      }
      await importItems(token, items)
    } finally {
      await photosFetch(token, `${PHOTOS_API}/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }).catch(() => undefined)
    }
  }

  function startImport() {
    if (!id || busy) {
      return
    }
    if (!connected) {
      setError("Supabase is not connected, so files cannot be saved yet.")
      return
    }
    cancelRef.current = false
    setBusy(true)
    setError(null)
    setShowSummary(false)
    commit([])
    setPickerLink(null)
    setStatus(null)

    void (async () => {
      try {
        await loadGis()
        const oauth = window.google?.accounts?.oauth2
        if (!oauth) {
          throw new Error("Could not load Google. Check your internet connection.")
        }
        if (!tokenClientRef.current) {
          tokenClientRef.current = oauth.initTokenClient({
            client_id: id,
            scope: PHOTOS_SCOPE,
            callback: () => undefined,
          })
        }
        const token = await new Promise<string>((resolve, reject) => {
          const tokenClient = tokenClientRef.current
          if (!tokenClient) {
            reject(new Error("Could not load Google. Check your internet connection."))
            return
          }
          tokenClient.callback = (response) => {
            if (response.error || !response.access_token) {
              if (response.error === "popup_closed" || response.error === "access_denied") {
                reject(new Error("The Google window was closed before you signed in."))
                return
              }
              if (response.error === "invalid_scope") {
                reject(new Error(PHOTOS_SETUP_NOTE))
                return
              }
              reject(new Error("Google did not sign you in. Try the button again."))
              return
            }
            resolve(response.access_token)
          }
          tokenClient.requestAccessToken({
            prompt: accessTokenRef.current ? "" : "consent",
          })
        })
        accessTokenRef.current = token
        await runSession(token)
      } catch (caught) {
        if (!cancelRef.current) {
          setError(caught instanceof Error ? caught.message : "Could not open Google Photos.")
        }
      } finally {
        setBusy(false)
        setStatus(null)
      }
    })()
  }

  function retryFailed() {
    const token = accessTokenRef.current
    const ids = rowsRef.current.filter((row) => row.status === "failed").map((row) => row.id)
    if (!token || ids.length === 0) {
      return
    }
    commit(
      rowsRef.current.map((row) =>
        row.status === "failed"
          ? { ...row, status: "waiting" as const, percent: null, detail: "Waiting" }
          : row,
      ),
    )
    setBusy(true)
    setShowSummary(false)
    const projectId = batchProjectRef.current
    const projectName = projectById(projectId).name
    void runPool(ids, UPLOAD_CONCURRENCY, async (id) => {
      const item = itemsRef.current.get(id)
      if (!item) {
        updateRow(id, { status: "failed", detail: "That file is no longer available. Choose it again." })
        return
      }
      await savePhoto(token, item, projectId, projectName)
    }).finally(() => {
      setBusy(false)
      setShowSummary(true)
    })
  }

  function cancelImport() {
    cancelRef.current = true
    setBusy(false)
    setStatus(null)
    setPickerLink(null)
  }

  const setupError = error === PHOTOS_SETUP_NOTE

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={startImport} disabled={!id || busy || !connected}>
        {busy ? "Working…" : "Import from Google Photos"}
      </Button>
      <p className="text-sm font-medium">Saving to: {project.name}</p>
      <p className="text-sm text-muted-foreground">
        {id
          ? "Copies the photos and videos you pick. Several save at once."
          : "Add the Google Client ID, then restart."}
      </p>
      {busy ? (
        <Button type="button" variant="outline" onClick={cancelImport}>
          Cancel
        </Button>
      ) : null}
      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
      {pickerLink ? (
        <a href={pickerLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">
          Open Google Photos to choose files
        </a>
      ) : null}
      {setupError ? (
        <div className="max-w-md rounded-lg border border-destructive/40 px-3 py-2 text-sm" role="alert">
          <ol className="list-decimal space-y-1 pl-5">
            <li>APIs & Services → Library. Enable Photos Picker API.</li>
            <li>Data Access → Add or remove scopes. Add the Photos scope. Save.</li>
            <li>Click Import from Google Photos and sign in again.</li>
          </ol>
        </div>
      ) : error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <FileQueue items={rows} onRemove={removeRow} />
      {showSummary && rows.length > 0 ? (
        <BatchSummary
          projectId={batchProjectId}
          projectName={projectById(batchProjectId).name}
          saved={rows.filter((row) => row.status === "done").length}
          skipped={rows
            .filter((row) => row.status === "skipped")
            .map((row) => ({ name: row.name, detail: row.detail }))}
          failed={rows.filter((row) => row.status === "failed").length}
          indexing={rows.filter((row) => row.status === "done" && row.detail.includes("Indexing")).length}
          onRetry={retryFailed}
          retrying={busy}
        />
      ) : null}
    </div>
  )
}
