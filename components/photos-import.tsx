"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
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
import { saveFileToLibrary } from "@/lib/save-to-library"
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

type ImportState = "waiting" | "checking" | "downloading" | "saving" | "imported" | "skipped" | "failed"

type ImportRow = {
  id: string
  name: string
  state: ImportState
  detail: string
}

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pickerLink, setPickerLink] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  function updateRow(rowId: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
  }

  async function importItems(token: string, items: PhotosMediaItem[]) {
    const starting: ImportRow[] = items.map((item, index) => ({
      id: item.id || `photo-${index}`,
      name: item.mediaFile?.filename?.trim() || "Google Photos item",
      state: "waiting",
      detail: "Waiting",
    }))
    setRows(starting)
    let imported = 0
    let skipped = 0
    let failed = 0
    const skippedLines: string[] = []

    for (const item of items) {
      const rowId = item.id || ""
      const name = item.mediaFile?.filename?.trim() || "Google Photos item"
      if (!rowId) {
        failed += 1
        continue
      }
      const notReady = videoSkipReason(item)
      if (notReady) {
        skipped += 1
        skippedLines.push(`${name}: ${notReady}`)
        updateRow(rowId, { name, state: "skipped", detail: notReady })
        continue
      }
      const url = photosContentUrl(item)
      if (!url) {
        failed += 1
        updateRow(rowId, { name, state: "failed", detail: "Google did not give a download link." })
        continue
      }
      updateRow(rowId, { name, state: "downloading", detail: "Downloading from Google Photos" })
      try {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) {
          throw new Error(await readGoogleError(response))
        }
        const lengthHeader = Number(response.headers.get("content-length"))
        if (Number.isFinite(lengthHeader) && lengthHeader > MAX_UPLOAD_BYTES) {
          await response.body?.cancel()
          skipped += 1
          const reason = "It is bigger than 50 MB, so it was not downloaded."
          skippedLines.push(`${name}: ${reason}`)
          updateRow(rowId, { name, state: "skipped", detail: reason })
          continue
        }
        const downloaded = await readUpTo(response, MAX_UPLOAD_BYTES)
        if (downloaded.tooBig) {
          skipped += 1
          const reason = "It is bigger than 50 MB, so it was not saved."
          skippedLines.push(`${name}: ${reason}`)
          updateRow(rowId, { name, state: "skipped", detail: reason })
          continue
        }
        const mimeType = item.mediaFile?.mimeType || downloaded.type || "application/octet-stream"
        const file = new File([downloaded.bytes], name, { type: mimeType })
        updateRow(rowId, { state: "saving", detail: `Saving to ${project.name}` })
        const saved = await saveFileToLibrary(file, project.id)
        imported += 1
        updateRow(rowId, { state: "imported", detail: `Saved as “${saved.title}”` })
      } catch (caught) {
        failed += 1
        const message = caught instanceof Error ? caught.message : "Could not import this file."
        updateRow(rowId, { state: "failed", detail: message })
      }
    }

    const skippedText = skippedLines.length > 0 ? ` Skipped: ${skippedLines.join(" ")}` : ""
    setSummary(`Imported ${imported}. Skipped ${skipped}. Failed ${failed}.${skippedText}`)
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
        setSummary("You did not choose any files.")
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
    setSummary(null)
    setRows([])
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
      <p className="text-sm text-muted-foreground">
        {id
          ? `Copies photos and videos you pick into ${project.name}.`
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
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
          {rows.map((row) => (
            <li key={row.id}>
              <span className="font-medium">{row.name}</span>
              <span className="text-muted-foreground"> — {row.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {summary ? (
        <p className="text-sm font-medium" role="status">
          {summary}
        </p>
      ) : null}
    </div>
  )
}
