"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BatchSummary, FileQueue, savedDetail, type QueueItem } from "@/components/file-queue"
import { useLeaveGuard } from "@/components/use-leave-guard"
import { useProject } from "@/components/project-provider"
import { projects, type ProjectId } from "@/lib/projects"
import { runPool, UPLOAD_CONCURRENCY } from "@/lib/run-pool"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { mediaTypeFromFile } from "@/lib/saved-media"
import { FILE_TOO_BIG_MESSAGE, formatUploadLimit, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

function rowForFile(file: File, id: string): QueueItem {
  if (!mediaTypeFromFile({ type: file.type, name: file.name })) {
    return {
      id,
      name: file.name,
      size: file.size,
      status: "skipped",
      percent: null,
      detail: "Not a photo or a video.",
    }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      id,
      name: file.name,
      size: file.size,
      status: "skipped",
      percent: null,
      detail: FILE_TOO_BIG_MESSAGE,
    }
  }
  if (file.size <= 0) {
    return {
      id,
      name: file.name,
      size: file.size,
      status: "skipped",
      percent: null,
      detail: "This file is empty, so it was not uploaded.",
    }
  }
  return {
    id,
    name: file.name,
    size: file.size,
    status: "waiting",
    percent: null,
    detail: "Waiting",
  }
}

export function UploadForm({ connected }: { connected: boolean }) {
  const { projectId, setProjectId } = useProject()
  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const filesRef = useRef(new Map<string, File>())
  const rowsRef = useRef<QueueItem[]>([])
  const runningRef = useRef(false)
  const batchProjectRef = useRef<ProjectId>(project.id)
  const [batchProjectId, setBatchProjectId] = useState<ProjectId>(project.id)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState(0)

  useLeaveGuard(running)

  useEffect(() => {
    const stop = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener("dragover", stop)
    window.addEventListener("drop", stop)
    return () => {
      window.removeEventListener("dragover", stop)
      window.removeEventListener("drop", stop)
    }
  }, [])

  function commit(next: QueueItem[]) {
    rowsRef.current = next
    setRows(next)
  }

  function updateRow(id: string, patch: Partial<QueueItem>) {
    commit(rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function addFiles(files: File[]) {
    if (files.length === 0) {
      setError("Choose at least one video.")
      return
    }
    const nextRows = files.map((file) => {
      const id = crypto.randomUUID()
      filesRef.current.set(id, file)
      return rowForFile(file, id)
    })
    commit([...rowsRef.current, ...nextRows])
    setFinished(false)
    setError(null)
    setInputKey((key) => key + 1)
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files
    if (!list || list.length === 0) {
      return
    }
    addFiles(Array.from(list))
  }

  function removeRow(id: string) {
    const row = rowsRef.current.find((item) => item.id === id)
    if (!row || row.status === "uploading") {
      return
    }
    filesRef.current.delete(id)
    commit(rowsRef.current.filter((item) => item.id !== id))
  }

  async function drain(target: ProjectId) {
    if (runningRef.current) {
      return
    }
    runningRef.current = true
    setRunning(true)
    setFinished(false)
    setError(null)
    try {
      while (rowsRef.current.some((row) => row.status === "waiting")) {
        const ids = rowsRef.current.filter((row) => row.status === "waiting").map((row) => row.id)
        await runPool(ids, UPLOAD_CONCURRENCY, async (id) => {
          const row = rowsRef.current.find((item) => item.id === id)
          const file = filesRef.current.get(id)
          if (!row || row.status !== "waiting" || !file) {
            return
          }
          updateRow(id, { status: "uploading", percent: null, detail: "Uploading…" })
          try {
            const saved = await saveFileToLibrary(file, target, (percent) => {
              updateRow(id, {
                percent,
                detail: percent == null ? "Uploading…" : `Uploading ${percent}%`,
              })
            })
            updateRow(id, {
              status: "done",
              percent: 100,
              detail: savedDetail(saved),
            })
          } catch (caught) {
            updateRow(id, {
              status: "failed",
              percent: null,
              detail: caught instanceof Error ? caught.message : "Could not save this file.",
            })
          }
        })
      }
    } finally {
      runningRef.current = false
      setRunning(false)
      setFinished(true)
    }
  }

  function startUpload() {
    if (!connected || runningRef.current) {
      return
    }
    if (!rowsRef.current.some((row) => row.status === "waiting")) {
      return
    }
    batchProjectRef.current = project.id
    setBatchProjectId(project.id)
    void drain(project.id)
  }

  function retryFailed() {
    const next = rowsRef.current.map((row) =>
      row.status === "failed"
        ? { ...row, status: "waiting" as const, percent: null, detail: "Waiting" }
        : row,
    )
    if (!next.some((row) => row.status === "waiting")) {
      return
    }
    commit(next)
    void drain(batchProjectRef.current)
  }

  const waiting = rows.filter((row) => row.status === "waiting").length
  const saved = rows.filter((row) => row.status === "done")
  const skipped = rows
    .filter((row) => row.status === "skipped")
    .map((row) => ({ name: row.name, detail: row.detail }))
  const failed = rows.filter((row) => row.status === "failed").length
  const indexing = saved.filter((row) => row.detail.includes("Indexing")).length
  const batchProject = projects.find((item) => item.id === batchProjectId) ?? project

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-lg border p-3" disabled={running}>
        <legend className="px-1 text-lg font-semibold">Saving to: {project.name}</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {projects.map((item) => {
            const selected = item.id === project.id
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium",
                  selected ? "border-primary bg-primary/10" : "border-input",
                  running && "cursor-not-allowed opacity-70",
                )}
              >
                <input
                  type="radio"
                  name="save-to"
                  value={item.id}
                  checked={selected}
                  disabled={running}
                  onChange={() => setProjectId(item.id)}
                />
                {item.name}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base sm:w-fit sm:px-8"
          onClick={() => fileInputRef.current?.click()}
        >
          Choose videos
        </Button>
        <input
          key={inputKey}
          ref={fileInputRef}
          id="media-file"
          type="file"
          multiple
          accept="video/*,image/*"
          onChange={onFileChange}
          className="sr-only"
        />
        <p className="text-base">
          Click Choose videos. Hold Ctrl (or Shift) to select many. Then Save.
        </p>
        <p className="text-sm text-muted-foreground">
          Each file can be {formatUploadLimit()}. They all save to {project.name}.
        </p>
      </div>

      <Button type="button" size="lg" onClick={startUpload} disabled={!connected || running || waiting === 0}>
        {running ? "Saving…" : "Save"}
      </Button>

      {running ? (
        <p className="text-sm text-muted-foreground" role="status">
          Leave this page open until the batch finishes.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <FileQueue items={rows} onRemove={removeRow} />

      {finished && rows.length > 0 ? (
        <BatchSummary
          projectId={batchProject.id}
          projectName={batchProject.name}
          saved={saved.length}
          skipped={skipped}
          failed={failed}
          indexing={indexing}
          onRetry={retryFailed}
          retrying={running}
        />
      ) : null}
    </div>
  )
}
