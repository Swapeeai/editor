"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { projects, type ProjectId } from "@/lib/projects"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { FILE_TOO_BIG_MESSAGE, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

type PreviewKind = "video" | "image"

type SavedReceipt = {
  fileName: string
  projectId: ProjectId
  projectName: string
  previewUrl: string
  kind: PreviewKind
}

function previewKind(file: File): PreviewKind | null {
  if (file.type.startsWith("video/")) {
    return "video"
  }
  if (file.type.startsWith("image/")) {
    return "image"
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
    return "video"
  }
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
    return "image"
  }
  return null
}

export function UploadForm({ connected }: { connected: boolean }) {
  const { projectId, setProjectId } = useProject()
  const project = projects.find((item) => item.id === projectId) ?? projects[0]
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<PreviewKind | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [receipt, setReceipt] = useState<SavedReceipt | null>(null)
  const [cantPlay, setCantPlay] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  function replacePreview(nextFile: File | null, nextKind: PreviewKind | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    if (!nextFile || !nextKind) {
      setFile(null)
      setKind(null)
      setPreviewUrl(null)
      setCantPlay(false)
      return
    }

    const url = URL.createObjectURL(nextFile)
    previewUrlRef.current = url
    setFile(nextFile)
    setKind(nextKind)
    setPreviewUrl(url)
    setCantPlay(false)
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (!nextFile) {
      return
    }

    const nextKind = previewKind(nextFile)
    setReceipt(null)
    if (!nextKind) {
      setError("Choose a photo or a video.")
      replacePreview(null, null)
      return
    }

    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError(FILE_TOO_BIG_MESSAGE)
    } else {
      setError(null)
    }
    replacePreview(nextFile, nextKind)
  }

  function uploadAnother() {
    setError(null)
    setReceipt(null)
    setProgress(null)
    replacePreview(null, null)
    setInputKey((key) => key + 1)
  }

  async function saveToLibrary() {
    if (!file || !kind || !previewUrl || !connected || saving) {
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(FILE_TOO_BIG_MESSAGE)
      return
    }

    const savedName = file.name
    const savedKind = kind
    const savedPreview = previewUrl
    setSaving(true)
    setError(null)
    setReceipt(null)
    setProgress(null)

    try {
      await saveFileToLibrary(file, project.id, setProgress)
      setReceipt({
        fileName: savedName,
        projectId: project.id,
        projectName: project.name,
        previewUrl: savedPreview,
        kind: savedKind,
      })
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save that file. Check that the app is running, then try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  const canSave = Boolean(file && connected && !saving && file.size <= MAX_UPLOAD_BYTES)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-col gap-3">
        <label
          htmlFor="media-file"
          className={cn(buttonVariants({ size: "lg" }), "h-10 w-fit cursor-pointer px-4")}
        >
          Choose a file from this computer
        </label>
        <Input
          key={inputKey}
          id="media-file"
          type="file"
          accept="image/*,video/*"
          onChange={onFileChange}
          className="sr-only"
        />
        {file ? <p className="text-sm font-medium break-all">{file.name}</p> : null}

        <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
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
                  )}
                >
                  <input
                    type="radio"
                    name="save-to"
                    value={item.id}
                    checked={selected}
                    onChange={() => setProjectId(item.id)}
                  />
                  {item.name}
                </label>
              )
            })}
          </div>
        </fieldset>

        <Button type="button" onClick={saveToLibrary} disabled={!canSave}>
          {saving ? "Saving…" : `Save to ${project.name}`}
        </Button>
      </div>

      {saving ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-sm font-medium">
            Saving {file?.name}
            {progress == null ? "…" : `… ${progress}%`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full bg-primary", progress == null && "w-1/3 animate-pulse")}
              style={progress == null ? undefined : { width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {receipt ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Saved to {receipt.projectName}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm font-medium break-all">{receipt.fileName}</p>
            {receipt.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.previewUrl}
                alt=""
                className="aspect-video w-full rounded-lg bg-muted object-contain"
              />
            ) : (
              <video
                src={receipt.previewUrl}
                className="aspect-video w-full rounded-lg bg-black"
                muted
              />
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/library?project=${receipt.projectId}`}
                className={cn(buttonVariants(), "h-8 px-2.5")}
              >
                View in library
              </Link>
              <Button type="button" variant="outline" onClick={uploadAnother}>
                Upload another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!file || !previewUrl || !kind ? (
              <p className="text-sm text-muted-foreground">No photo or video chosen yet.</p>
            ) : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Preview of ${file.name}`}
                className="aspect-video w-full rounded-lg bg-muted object-contain"
              />
            ) : (
              <video
                key={previewUrl}
                controls
                src={previewUrl}
                className="aspect-video w-full rounded-lg bg-black"
                onError={() => setCantPlay(true)}
                onCanPlay={() => setCantPlay(false)}
              />
            )}
            {kind === "video" && cantPlay ? (
              <p className="text-sm text-destructive" role="alert">
                This browser cannot play that file. The file name above is still correct.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </form>
  )
}
