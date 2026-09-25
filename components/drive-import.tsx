"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useProject } from "@/components/project-provider"
import { parseDriveLinks } from "@/lib/drive-link"
import { bytesFromDriveSize, planDriveImport } from "@/lib/drive-import-plan"
import { getGoogleDriveConfig } from "@/lib/google-config"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

const EXPECTED_ORIGIN = "http://localhost:43123"
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

const PICKER_FIX =
  "Google could not open the file window. In Google Cloud, open APIs & Services, then Library, search for Google Picker API, and click Enable. You can paste Drive links below instead."

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
        Action: { PICKED: string; CANCEL: string; ERROR?: string }
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

function signInMessage(error: string | undefined) {
  if (error === "popup_closed" || error === "access_denied") {
    return "The Google window was closed before you signed in."
  }
  return "Google did not sign you in. Try the button again."
}

function refusedMessage(driveReadonly: boolean) {
  if (driveReadonly) {
    return "Google refused this file. Check that you can open it in Drive, and that you allowed the wider Drive read permission when you signed in."
  }
  return "Google refused this file. The normal permission only covers files you choose in the Picker. Pick it there, or set NEXT_PUBLIC_GOOGLE_DRIVE_READONLY=yes and sign in again. The setup guide explains that screen."
}

async function driveMetadata(token: string, id: string, driveReadonly: boolean) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (response.status === 401) {
    throw new Error("Google sign-in expired. Click the button and sign in again.")
  }
  if (response.status === 403 || response.status === 404) {
    throw new Error(refusedMessage(driveReadonly))
  }
  if (!response.ok) {
    throw new Error("Could not read this file from Google Drive.")
  }
  return (await response.json()) as {
    name?: string
    mimeType?: string
    size?: string
  }
}

async function downloadDriveFile(
  token: string,
  id: string,
  name: string,
  mimeType: string,
  driveReadonly: boolean,
) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (response.status === 401) {
    throw new Error("Google sign-in expired. Click the button and sign in again.")
  }
  if (response.status === 403 || response.status === 404) {
    throw new Error(refusedMessage(driveReadonly))
  }
  if (!response.ok) {
    throw new Error("Could not download this file from Google Drive.")
  }
  const blob = await response.blob()
  return new File([blob], name, { type: mimeType || blob.type })
}

function pickerMessageLooksLikeKeyError(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data ?? "")
  return /developer key is invalid|api key is invalid/i.test(text)
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
  const [links, setLinks] = useState("")

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  async function importPicked(token: string, docs: PickedDoc[], extraProblems: string[] = []) {
    const projectId = project.id
    const driveReadonly = Boolean(google?.driveReadonly)
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
        const meta = await driveMetadata(token, id, driveReadonly)
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
        const file = await downloadDriveFile(token, id, ready.name, ready.mimeType, driveReadonly)
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

    const skippedText = skippedLines.length > 0 ? ` Skipped: ${skippedLines.join(" ")}` : ""
    const problemText = extraProblems.length > 0 ? ` ${extraProblems.join(" ")}` : ""
    setSummary(`Imported ${imported}. Skipped ${skipped}. Failed ${failed}.${skippedText}${problemText}`)
  }

  function showPickerFailure() {
    setError(PICKER_FIX)
    setBusy(false)
  }

  function openPicker(token: string) {
    const pickerApi = window.google?.picker
    const config = getGoogleDriveConfig()
    if (!pickerApi || !config) {
      setError("Google Drive is not connected yet. See the setup guide.")
      setBusy(false)
      return
    }

    const onPickerMessage = (event: MessageEvent) => {
      if (event.origin !== "https://docs.google.com" && event.origin !== "https://drive.google.com") {
        return
      }
      if (pickerMessageLooksLikeKeyError(event.data)) {
        window.removeEventListener("message", onPickerMessage)
        showPickerFailure()
      }
    }
    window.addEventListener("message", onPickerMessage)

    try {
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

      let builder = new pickerApi.PickerBuilder()
        .enableFeature(pickerApi.Feature.MULTISELECT_ENABLED)
        .setAppId(config.appId)
        .setOAuthToken(token)
        .setOrigin(window.location.origin)
      if (config.apiKey) {
        builder = builder.setDeveloperKey(config.apiKey)
      }
      const picker = builder
        .setTitle(`Choose files for ${project.name}`)
        .addView(videos)
        .addView(photos)
        .setCallback((data) => {
          const action = actionOf(data)
          const errorAction = pickerApi.Action.ERROR
          if (action === pickerApi.Action.CANCEL || action === "cancel") {
            window.removeEventListener("message", onPickerMessage)
            setBusy(false)
            return
          }
          if (pickerMessageLooksLikeKeyError(data)) {
            window.removeEventListener("message", onPickerMessage)
            showPickerFailure()
            return
          }
          if ((errorAction && action === errorAction) || action === "error") {
            window.removeEventListener("message", onPickerMessage)
            showPickerFailure()
            return
          }
          if (action !== pickerApi.Action.PICKED && action !== "picked") {
            return
          }
          window.removeEventListener("message", onPickerMessage)
          const docs = pickedDocuments(data)
          if (docs.length === 0) {
            setBusy(false)
            return
          }
          void importPicked(token, docs).finally(() => setBusy(false))
        })
        .build()
      picker.setVisible(true)
    } catch {
      window.removeEventListener("message", onPickerMessage)
      showPickerFailure()
    }
  }

  async function withGoogleToken(onToken: (token: string) => void) {
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
          scope: google.scope,
          callback: () => undefined,
        })
      }
      const tokenClient = tokenClientRef.current
      tokenClient.callback = (response) => {
        if (response.error || !response.access_token) {
          setBusy(false)
          setError(signInMessage(response.error))
          return
        }
        accessTokenRef.current = response.access_token
        onToken(response.access_token)
      }
      tokenClient.requestAccessToken({
        prompt: accessTokenRef.current ? "" : "consent",
      })
    } catch (caught) {
      setBusy(false)
      setError(caught instanceof Error ? caught.message : "Could not open Google Drive.")
    }
  }

  function startImport() {
    void withGoogleToken((token) => openPicker(token))
  }

  function startLinkImport() {
    const parsed = parseDriveLinks(links)
    if (parsed.files.length === 0) {
      setSummary(null)
      setError(
        parsed.problems[0] ?? "Paste a Google Drive file link. One link per line.",
      )
      return
    }
    void withGoogleToken((token) => {
      void importPicked(
        token,
        parsed.files.map((file) => ({ id: file.id, name: "Drive file" })),
        parsed.problems,
      ).finally(() => setBusy(false))
    })
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
        be 50 MB or smaller. Open this page at {EXPECTED_ORIGIN}. If the Google
        window cannot open, enable Google Picker API, or paste links below.
      </p>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="drive-links" className="text-sm font-medium">
          Paste a Google Drive link
        </label>
        <Textarea
          id="drive-links"
          value={links}
          onChange={(event) => setLinks(event.target.value)}
          rows={4}
          placeholder={"One file link per line\nhttps://drive.google.com/file/d/…/view"}
          className="min-h-24"
        />
        <p className="text-sm text-muted-foreground">
          {google.driveReadonly
            ? "The wider Drive read permission is on, so a link to a file you can open can be copied."
            : "The normal permission only covers files you choose in the Picker. If a pasted link is refused, pick that file in the window, or turn on NEXT_PUBLIC_GOOGLE_DRIVE_READONLY in the setup guide."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={startLinkImport}
          disabled={busy || !connected}
        >
          Import these links
        </Button>
      </div>

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
