"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { saveFileToLibrary } from "@/lib/save-to-library"
import { FILE_TOO_BIG_MESSAGE, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

type PreviewKind = "video" | "image"

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
  const { project } = useProject()
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<PreviewKind | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
    if (!nextKind) {
      setError("Choose a photo or a video.")
      setStatus(null)
      setSaved(false)
      replacePreview(null, null)
      return
    }

    setStatus(null)
    setSaved(false)
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError(FILE_TOO_BIG_MESSAGE)
    } else {
      setError(null)
    }
    replacePreview(nextFile, nextKind)
  }

  function clearPreview() {
    setError(null)
    setStatus(null)
    setSaved(false)
    replacePreview(null, null)
    setInputKey((key) => key + 1)
  }

  async function saveToLibrary() {
    if (!file || !connected || saving) {
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(FILE_TOO_BIG_MESSAGE)
      return
    }

    setSaving(true)
    setError(null)
    setStatus("Saving…")

    try {
      const savedFile = await saveFileToLibrary(file, project.id)
      setSaved(true)
      setStatus(
        `Saved “${savedFile.title}” to ${project.name}. Open the Media Library to see it.`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reach the save service. Check that the app is running, then try again.",
      )
      setStatus(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-col gap-2">
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
        <p className="text-sm text-muted-foreground">
          This file belongs to {project.name}.
        </p>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-sm font-medium text-primary" role="status">
          {status}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!file || !previewUrl || !kind ? (
            <p className="text-sm text-muted-foreground">
              No photo or video chosen yet.
            </p>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">File name: </span>
                <span className="font-medium break-all">{file.name}</span>
              </p>
              {kind === "image" ? (
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
                  This browser cannot play that file. The file name above is
                  still correct.
                </p>
              ) : null}
            </>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={saveToLibrary}
              disabled={
                !file ||
                !connected ||
                saving ||
                saved ||
                file.size > MAX_UPLOAD_BYTES
              }
            >
              {saving ? "Saving…" : saved ? "Saved" : "Save to library"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={clearPreview}
              disabled={!file || saving}
            >
              Clear preview
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
