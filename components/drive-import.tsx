"use client"

import { useRef, useState } from "react"
import { BatchSummary, FileQueue, savedDetail, type QueueItem } from "@/components/file-queue"
import { useLeaveGuard } from "@/components/use-leave-guard"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useProject } from "@/components/project-provider"
import { parseDriveLinks } from "@/lib/drive-link"
import { bytesFromDriveSize, planDriveImport } from "@/lib/drive-import-plan"
import { getGoogleDriveConfig } from "@/lib/google-config"
import { projectById, type ProjectId } from "@/lib/projects"
import { runPool, UPLOAD_CONCURRENCY } from "@/lib/run-pool"
import { HEIC_CONVERT_MESSAGE, isHeicFile } from "@/lib/heic-photo"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { fileTooBigMessage, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

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
  "Could not open Google Drive. Enable Google Picker API, then try again."

type ImportRow = QueueItem

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
    return "Google refused this file. Sign in again, then retry the link."
  }
  return "Google refused this file. Pick it in the Drive window instead."
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
  const rowsRef = useRef<ImportRow[]>([])
  const docsRef = useRef(new Map<string, PickedDoc>())
  const batchProjectRef = useRef<ProjectId>(project.id)
  const [batchProjectId, setBatchProjectId] = useState<ProjectId>(project.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [showSummary, setShowSummary] = useState(false)
  const [linkProblems, setLinkProblems] = useState<string[]>([])
  const [links, setLinks] = useState("")
  const [moreOptions, setMoreOptions] = useState(false)

  useLeaveGuard(rows.some((row) => row.status === "uploading"))

  function commit(next: ImportRow[]) {
    rowsRef.current = next
    setRows(next)
  }

  function updateRow(id: string, patch: Partial<ImportRow>) {
    commit(rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id)
    if (!row || row.status === "uploading") {
      return
    }
    docsRef.current.delete(id)
    commit(rowsRef.current.filter((item) => item.id !== id))
  }

  async function saveDriveFile(token: string, doc: PickedDoc, projectId: ProjectId, projectName: string) {
    const id = doc.id || ""
    const row = rowsRef.current.find((item) => item.id === id)
    if (!id || !row || row.status !== "waiting") {
      return
    }
    const driveReadonly = Boolean(google?.driveReadonly)
    const fallbackName = doc.name?.trim() || "Untitled"
    updateRow(id, { status: "uploading", percent: null, detail: "Checking size" })
    try {
      const meta = await driveMetadata(token, id, driveReadonly)
      const name = meta.name?.trim() || fallbackName
      const mimeType = meta.mimeType || doc.mimeType || ""
      const size = bytesFromDriveSize(meta.size ?? doc.sizeBytes)
      const plan = planDriveImport([{ id, name, mimeType, size }])
      if (plan.skipped.length > 0) {
        updateRow(id, {
          name,
          size,
          status: "skipped",
          percent: null,
          detail: plan.skipped[0]?.reason ?? "Skipped",
        })
        return
      }
      const ready = plan.ready[0]
      if (!ready) {
        updateRow(id, { name, status: "skipped", detail: "Skipped" })
        return
      }
      updateRow(id, { name, size: ready.size, detail: "Downloading from Google Drive" })
      const file = await downloadDriveFile(token, id, ready.name, ready.mimeType, driveReadonly)
      if (file.size > MAX_UPLOAD_BYTES) {
        updateRow(id, {
          name,
          size: file.size,
          status: "skipped",
          percent: null,
          detail: fileTooBigMessage("saved"),
        })
        return
      }
      updateRow(id, {
        size: file.size,
        detail: isHeicFile(file) ? HEIC_CONVERT_MESSAGE : `Saving to ${projectName}`,
      })
      const saved = await saveFileToLibrary(
        file,
        projectId,
        (percent) => {
          updateRow(id, {
            percent,
            detail: percent == null ? `Saving to ${projectName}` : `Uploading ${percent}%`,
          })
        },
        (detail) => {
          updateRow(id, { detail, percent: null })
        },
      )
      updateRow(id, {
        name: saved.fileName,
        size: saved.size,
        status: "done",
        percent: 100,
        detail: savedDetail(saved),
      })
    } catch (caught) {
      updateRow(id, {
        status: "failed",
        percent: null,
        detail: caught instanceof Error ? caught.message : "Could not import this file.",
      })
    }
  }

  async function importPicked(token: string, docs: PickedDoc[], extraProblems: string[] = []) {
    docsRef.current = new Map()
    const starting: ImportRow[] = docs.map((doc, index) => {
      const id = doc.id || `missing-${index}`
      if (doc.id) {
        docsRef.current.set(doc.id, doc)
      }
      const knownSize = bytesFromDriveSize(doc.sizeBytes)
      if (!doc.id) {
        return {
          id,
          name: doc.name?.trim() || "Untitled",
          size: knownSize,
          status: "failed" as const,
          percent: null,
          detail: "Google did not give an id.",
        }
      }
      return {
        id,
        name: doc.name?.trim() || "Untitled",
        size: knownSize,
        status: "waiting" as const,
        percent: null,
        detail: "Waiting",
      }
    })
    commit(starting)
    setShowSummary(false)
    setLinkProblems(extraProblems)
    const projectId = project.id
    const projectName = project.name
    batchProjectRef.current = projectId
    setBatchProjectId(projectId)
    await runPool(
      starting.filter((row) => row.status === "waiting").map((row) => row.id),
      UPLOAD_CONCURRENCY,
      async (id) => {
        const doc = docsRef.current.get(id)
        if (!doc) {
          return
        }
        await saveDriveFile(token, doc, projectId, projectName)
      },
    )
    setShowSummary(true)
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
      const doc = docsRef.current.get(id)
      if (!doc) {
        updateRow(id, { status: "failed", detail: "That file is no longer available. Choose it again." })
        return
      }
      await saveDriveFile(token, doc, projectId, projectName)
    }).finally(() => {
      setBusy(false)
      setShowSummary(true)
    })
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
    setShowSummary(false)

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
      setShowSummary(false)
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

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={startImport} disabled={!google || busy || !connected}>
        {busy ? "Working…" : "Import from Google Drive"}
      </Button>
      <p className="text-sm font-medium">Saving to: {project.name}</p>
      <p className="text-sm text-muted-foreground">
        {google
          ? "Copies the files you pick. Several save at once."
          : "Add the Google Client ID and project number, then restart."}
      </p>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {google ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit px-0"
            aria-expanded={moreOptions}
            onClick={() => setMoreOptions((open) => !open)}
          >
            More options
          </Button>
          {moreOptions ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="drive-links" className="text-sm font-medium">
                Paste a Google Drive link
              </label>
              <Textarea
                id="drive-links"
                value={links}
                onChange={(event) => setLinks(event.target.value)}
                rows={3}
                placeholder="One file link per line"
                className="min-h-20"
              />
              <Button
                type="button"
                variant="outline"
                onClick={startLinkImport}
                disabled={busy || !connected}
              >
                Import these links
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <FileQueue items={rows} onRemove={removeRow} />
      {linkProblems.length > 0 ? (
        <p className="text-sm text-muted-foreground">{linkProblems.join(" ")}</p>
      ) : null}
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
