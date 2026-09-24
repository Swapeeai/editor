"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null)
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

  function replacePreview(nextFile: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    if (!nextFile) {
      setFile(null)
      setPreviewUrl(null)
      setCantPlay(false)
      return
    }

    const url = URL.createObjectURL(nextFile)
    previewUrlRef.current = url
    setFile(nextFile)
    setPreviewUrl(url)
    setCantPlay(false)
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (!nextFile) {
      return
    }

    if (nextFile.type && !nextFile.type.startsWith("video/")) {
      setError("That file is not a video. Choose a video file.")
      replacePreview(null)
      return
    }

    setError(null)
    replacePreview(nextFile)
  }

  function clearPreview() {
    setError(null)
    replacePreview(null)
    setInputKey((key) => key + 1)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="video-file" className="text-sm font-medium">
          Video file
        </label>
        <Input
          key={inputKey}
          id="video-file"
          type="file"
          accept="video/*"
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
          {!file || !previewUrl ? (
            <p className="text-sm text-muted-foreground">No video chosen yet.</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">File name: </span>
                <span className="font-medium break-all">{file.name}</span>
              </p>
              <video
                key={previewUrl}
                controls
                src={previewUrl}
                className="aspect-video w-full rounded-lg bg-black"
                onError={() => setCantPlay(true)}
                onCanPlay={() => setCantPlay(false)}
              />
              {cantPlay ? (
                <p className="text-sm text-destructive" role="alert">
                  This browser cannot play that file. The file name above is
                  still correct.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  If the player stays blank, this browser cannot play that file.
                </p>
              )}
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
