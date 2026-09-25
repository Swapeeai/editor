"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useProject } from "@/components/project-provider"
import { bytesFromDriveSize, planDriveImport } from "@/lib/drive-import-plan"
import { getGoogleDriveConfig } from "@/lib/google-config"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/mpeg",
  "video/ogg",
  "video/x-msvideo",
].join(",")
const PHOTO_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/heic",
  "image/heif",
].join(",")

type ImportState = "waiting" | "checking" | "downloading" | "saving" | "imported" | "skipped" | "failed"

type ImportRow = {
  id: string
  name: string
  state: ImportState
  detail: string
}

type PickedDoc = {
  id?: string
  name?: string
  mimeType?: string
  sizeBytes?: number | string
}

type TokenResponse = {
  error?: string
  access_token?: string
}

type TokenClient = {
  callback: (response: TokenResponse) => void
  requestAccessToken: (options: { prompt: string }) => void
}

declare global {
  interface Window {
    gapi?: {
      load: (
        name: string,
        options: { callback: () => void; onerror?: () => void },
      ) => void
    }
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
          }) => TokenClient
        }
      }
      picker?: {
        Action: { PICKED: string; CANCEL: string }
        Response: { ACTION: string; DOCUMENTS: string }
        ViewId: { DOCS: string }
        DocsViewMode?: { LIST: string }
        Feature: { MULTISELECT_ENABLED: string }
        DocsView: new (viewId: string) => {
          setMimeTypes: (value: string) => DriveView
          setIncludeFolders: (value: boolean) => DriveView
          setSelectFolderEnabled: (value: boolean) => DriveView
          setMode: (value: string) => DriveView
          setLabel: (value: string) => DriveView
        }
        PickerBuilder: new () => PickerBuilder
      }
    }
  }
}

type DriveView = {
  setMimeTypes: (value: string) => DriveView
  setIncludeFolders: (value: boolean) => DriveView
  setSelectFolderEnabled: (value: boolean) => DriveView
  setMode: (value: string) => DriveView
  setLabel: (value: string) => DriveView
}

type PickerBuilder = {
  enableFeature: (feature: string) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setAppId: (id: string) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  setOrigin: (origin: string) => PickerBuilder
  setTitle: (title: string) => PickerBuilder
  addView: (view: DriveView) => PickerBuilder
  setCallback: (callback: (data: Record<string, unknown>) => void) => PickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

let googleScripts: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
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

function loadGoogle() {
  if (!googleScripts) {
    googleScripts = (async () => {
      await loadScript("https://accounts.google.com/gsi/client")
      await loadScript("https://apis.google.com/js/api.js")
      await new Promise<void>((resolve, reject) => {
        if (!window.gapi?.load) {
          reject(new Error("Could not load Google. Check your internet connection."))
          return
        }
        window.gapi.load("picker", {
          callback: () => resolve(),
          onerror: () => reject(new Error("Could not load Google. Check your internet connection.")),
        })
      })
    })().catch((error: unknown) => {
      googleScripts = null
      throw error
    })
  }
  return googleScripts
}

function pickedDocuments(data: Record<string, unknown>): PickedDoc[] {
  const docs = data.docs ?? data[window.google?.picker?.Response.DOCUMENTS ?? "docs"]
  return Array.isArray(docs) ? (docs as PickedDoc[]) : []
}

function actionOf(data: Record<string, unknown>) {
  const key = window.google?.picker?.Response.ACTION ?? "action"
  return String(data[key] ?? data.action ?? "")
}

async function driveMetadata(token: string, id: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) {
    throw new Error("Could not read this file from Google Drive.")
  }
  return (await response.json()) as {
    name?: string
    mimeType?: string
    size?: string
  }
}

async function downloadDriveFile(token: string, id: string, name: string, mimeType: string) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!response.ok) {
    throw new Error("Could not download this file from Google Drive.")
  }
  const blob = await response.blob()
  return new File([blob], name, { type: mimeType || blob.type })
}

export function DriveImport({ connected }: { connected: boolean }) {
  const { project } = useProject()
  const google = getGoogleDriveConfig()
  const tokenClientRef = useRef<TokenClient | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  async function importPicked(token: string, docs: PickedDoc[]) {
    const projectId = project.id
    const starting: ImportRow[] = docs.map((doc, index) => ({
      id: doc.id || `missing-${index}`,
      name: doc.name?.trim() || "Untitled",
      state: "waiting",
      detail: "Waiting",
    }))
    setRows(starting)
    setSummary(null)

    let imported = 0
    let skipped = 0
    let failed = 0
    const skippedLines: string[] = []

    for (const doc of docs) {
      const id = doc.id || ""
      const fallbackName = doc.name?.trim() || "Untitled"
      if (!id) {
        failed += 1
        continue
      }
      updateRow(id, { state: "checking", detail: "Checking size" })
      try {
        const meta = await driveMetadata(token, id)
        const name = meta.name?.trim() || fallbackName
        const mimeType = meta.mimeType || doc.mimeType || ""
        const size = bytesFromDriveSize(meta.size ?? doc.sizeBytes)
        const plan = planDriveImport([{ id, name, mimeType, size }])
        if (plan.skipped.length > 0) {
          skipped += 1
          const reason = plan.skipped[0]?.reason ?? "Skipped"
          skippedLines.push(`${name}: ${reason}`)
          updateRow(id, { name, state: "skipped", detail: reason })
          continue
        }
        const ready = plan.ready[0]
        if (!ready || ready.size > MAX_UPLOAD_BYTES) {
          skipped += 1
          const reason = "It is bigger than 50 MB, so it was not downloaded."
          skippedLines.push(`${name}: ${reason}`)
          updateRow(id, { name, state: "skipped", detail: reason })
          continue
        }

        updateRow(id, { name, state: "downloading", detail: "Downloading from Google Drive" })
        const file = await downloadDriveFile(token, id, ready.name, ready.mimeType)
        if (file.size > MAX_UPLOAD_BYTES) {
          skipped += 1
          const reason = "It is bigger than 50 MB, so it was not saved."
          skippedLines.push(`${name}: ${reason}`)
          updateRow(id, { name, state: "skipped", detail: reason })
          continue
        }

        updateRow(id, { state: "saving", detail: `Saving to ${project.name}` })
        const saved = await saveFileToLibrary(file, projectId)
        imported += 1
        updateRow(id, { state: "imported", detail: `Saved as “${saved.title}”` })
      } catch (caught) {
        failed += 1
        const message = caught instanceof Error ? caught.message : "Could not import this file."
        updateRow(id, { state: "failed", detail: message })
      }
    }

    const skippedText =
      skippedLines.length > 0 ? ` Skipped: ${skippedLines.join(" ")}` : ""
    setSummary(`Imported ${imported}. Skipped ${skipped}. Failed ${failed}.${skippedText}`)
  }

  function openPicker(token: string) {
    const pickerApi = window.google?.picker
    const config = getGoogleDriveConfig()
    if (!pickerApi || !config) {
      setError("Google Drive is not connected yet. See the setup guide.")
      setBusy(false)
      return
    }

    const videos = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
    videos.setMimeTypes(VIDEO_MIMES)
    videos.setIncludeFolders(true)
    videos.setSelectFolderEnabled(false)
    videos.setLabel("Videos")
    if (pickerApi.DocsViewMode?.LIST) {
      videos.setMode(pickerApi.DocsViewMode.LIST)
    }

    const photos = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
    photos.setMimeTypes(PHOTO_MIMES)
    photos.setIncludeFolders(true)
    photos.setSelectFolderEnabled(false)
    photos.setLabel("Photos")
    if (pickerApi.DocsViewMode?.LIST) {
      photos.setMode(pickerApi.DocsViewMode.LIST)
    }

    const picker = new pickerApi.PickerBuilder()
      .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setOAuthToken(token)
      .setOrigin(window.location.origin)
      .setTitle(`Choose files for ${project.name}`)
      .addView(videos)
      .addView(photos)
      .setCallback((data) => {
        const action = actionOf(data)
        if (action === pickerApi.Action.CANCEL || action === "cancel") {
          setBusy(false)
          return
        }
        if (action !== pickerApi.Action.PICKED && action !== "picked") {
          return
        }
        const docs = pickedDocuments(data)
        if (docs.length === 0) {
          setBusy(false)
          return
        }
        void importPicked(token, docs).finally(() => setBusy(false))
      })
      .build()
    picker.setVisible(true)
  }

  async function startImport() {
    if (!google || busy) {
      return
    }
    if (!connected) {
      setError("Supabase is not connected, so files cannot be saved yet.")
      return
    }

    setBusy(true)
    setError(null)
    setSummary(null)

    try {
      await loadGoogle()
      const oauth = window.google?.accounts?.oauth2
      if (!oauth) {
        throw new Error("Could not load Google. Check your internet connection.")
      }
      if (!tokenClientRef.current) {
        tokenClientRef.current = oauth.initTokenClient({
          client_id: google.clientId,
          scope: DRIVE_SCOPE,
          callback: () => undefined,
        })
      }
      const tokenClient = tokenClientRef.current
      tokenClient.callback = (response) => {
        if (response.error || !response.access_token) {
          setBusy(false)
          setError(
            response.error === "popup_closed"
              ? "The Google window was closed before you signed in."
              : "Google did not sign you in. Try the button again.",
          )
          return
        }
        accessTokenRef.current = response.access_token
        openPicker(response.access_token)
      }
      tokenClient.requestAccessToken({
        prompt: accessTokenRef.current ? "" : "consent",
      })
    } catch (caught) {
      setBusy(false)
      setError(caught instanceof Error ? caught.message : "Could not open Google Drive.")
    }
  }

  if (!google) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" disabled>
          Google Drive not connected yet — see setup guide
        </Button>
        <p className="text-sm text-muted-foreground">
          This copies files you pick into {project.name}. It does not keep
          watching Google Drive. The steps are in{" "}
          <span className="font-medium">docs/google-drive-setup.md</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" onClick={startImport} disabled={busy || !connected}>
        {busy ? "Working with Google Drive…" : "Import from Google Drive"}
      </Button>
      <p className="text-sm text-muted-foreground">
        Pick videos or photos once. They are copied into {project.name}. The
        app does not sync Drive later. Videos are listed first. Each file must
        be 50 MB or smaller. If Google says the API key is invalid, edit the
        key and also tick Google Picker API, then Save.
      </p>
      {error ? (
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
