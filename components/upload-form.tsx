"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

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

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<PreviewKind | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
      replacePreview(null, null)
      return
    }

    setError(null)
    replacePreview(nextFile, nextKind)
  }

  function clearPreview() {
    setError(null)
    replacePreview(null, null)
    setInputKey((key) => key + 1)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="media-file" className="text-sm font-medium">
          Photo or video
        </label>
        <Input
          key={inputKey}
          id="media-file"
          type="file"
          accept="image/*,video/*"
          onChange={onFileChange}
          className="h-auto cursor-pointer py-2"
        />
        <p className="text-sm text-muted-foreground">
          Nothing is uploaded. This preview stays in this tab until you refresh
          the page.
        </p>
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
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
              {kind === "video" && !cantPlay ? (
                <p className="text-sm text-muted-foreground">
                  If the player stays blank, this browser cannot play that file.
                </p>
              ) : null}
            </>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={clearPreview}
            disabled={!file}
          >
            Clear preview
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
