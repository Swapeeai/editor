"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { ProjectId } from "@/lib/projects"
import type { SampleMedia } from "@/lib/sample-media"

export type StoryScene = {
  id: string
  phrase: string
  media: SampleMedia | null
  reason: string
  announce: boolean
  clipStart: number
}

function sceneSeconds(scene: StoryScene) {
  return scene.media?.mediaType === "photo" ? 3 : 5
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

function rangeLabel(scenes: StoryScene[], index: number) {
  let start = 0
  for (let item = 0; item < index; item += 1) {
    start += sceneSeconds(scenes[item])
  }
  const end = start + sceneSeconds(scenes[index])
  return `${formatClock(start)}–${formatClock(end)}`
}

const SAVED_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function Storyboard({
  scenes,
  projectId,
  titleText,
  campDate,
  campLocation,
  onMove,
  onRemove,
  onStartChange,
}: {
  scenes: StoryScene[]
  projectId: ProjectId
  titleText: string
  campDate: string
  campLocation: string
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onStartChange: (index: number, start: number) => void
}) {
  const totalSeconds = scenes.reduce((sum, scene) => sum + sceneSeconds(scene), 0)
  const total = formatClock(totalSeconds)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const ready = scenes.length > 0 && scenes.every((scene) => scene.media && SAVED_ID.test(scene.media.id))

  async function exportVideo() {
    if (!ready || exporting) {
      return
    }
    setExporting(true)
    setExportError(null)
    setExportNote(null)
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl)
      setDownloadUrl(null)
    }
    try {
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          titleText,
          date: campDate,
          location: campLocation,
          scenes: scenes.map((scene) => ({
            mediaId: scene.media?.id,
            startSeconds: scene.media?.mediaType === "photo" ? 0 : scene.clipStart,
          })),
        }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setExportError(payload.error || "Could not make the video.")
        return
      }
      const blob = await response.blob()
      setDownloadUrl(URL.createObjectURL(blob))
      const note = response.headers.get("X-Export-Note")
      const saved = response.headers.get("X-Export-Saved")
      setExportNote(
        `${note ?? ""} ${saved === "yes" ? "A copy was also saved in this project’s library." : ""}`.trim(),
      )
    } catch {
      setExportError("Could not make the video. Check that the app is running, then try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Running timeline</h2>
        <p className="text-sm text-muted-foreground">
          {scenes.length === 0
            ? "No scenes yet."
            : `${scenes.length} scenes · about ${total}. Videos use 5 seconds. Photos use 3 seconds.`}
        </p>
      </div>

      {scenes.length > 0 ? (
        <ol className="flex flex-col gap-2 sm:flex-row">
          {scenes.map((scene, index) => (
            <li
              key={scene.id}
              className="min-w-0 flex-1 rounded-lg bg-primary/10 px-3 py-2"
            >
              <p className="text-xs font-medium">{rangeLabel(scenes, index)}</p>
              <p className="truncate text-sm">
                {scene.media?.title ?? "No match"}
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      <ol className="flex flex-col gap-4" aria-live="polite">
        {scenes.map((scene, index) => (
          <li key={scene.id}>
            <Card>
              <CardHeader>
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  Scene {index + 1} · {rangeLabel(scenes, index)}
                </p>
                <CardTitle className="break-words">
                  {scene.media?.title ?? "No match"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  {scene.media?.mediaType === "video" && scene.media.playbackUrl ? (
                    <video
                      controls
                      src={scene.media.playbackUrl}
                      className="aspect-video w-full rounded-lg bg-black object-contain sm:w-40"
                    />
                  ) : scene.media?.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={scene.media.poster}
                      alt=""
                      width={640}
                      height={360}
                      className="aspect-video w-full rounded-lg object-cover sm:w-40"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground sm:w-40">
                      No thumbnail
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                    <p className="break-words">
                      <span className="text-muted-foreground">Direction: </span>
                      {scene.phrase}
                    </p>
                    {scene.media ? (
                      <p>
                        <span className="text-muted-foreground">Chosen: </span>
                        {scene.media.mediaType === "video" ? "Video" : "Photo"}
                        {" · "}
                        {scene.media.retreatName} {scene.media.year}
                        {" · "}
                        {scene.media.location}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">{scene.reason}</p>
                    {scene.media?.mediaType === "video" ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-muted-foreground">
                          Start at second in this clip
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={scene.clipStart}
                          onChange={(event) =>
                            onStartChange(index, Number(event.target.value))
                          }
                          className="h-10 w-28"
                        />
                      </label>
                    ) : null}
                    {scene.announce ? (
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <p className="font-medium">On-screen text</p>
                        <p>{titleText.trim() || "No title text yet"}</p>
                        <p>{campDate.trim() || "No camp date yet"}</p>
                        <p>{campLocation.trim() || "No camp location yet"}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onMove(index, -1)}
                    disabled={index === 0}
                  >
                    Move earlier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onMove(index, 1)}
                    disabled={index === scenes.length - 1}
                  >
                    Move later
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRemove(index)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-col items-start gap-2">
        <Button type="button" onClick={exportVideo} disabled={!ready || exporting}>
          {exporting ? "Making the video…" : "Export"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {ready
            ? "Makes a vertical 1080×1920 MP4. Each video uses 5 seconds from the start second you set. Photos stay for 3 seconds. There is no sound. A plain title card is added at the start. Twelve Labs is not connected."
            : "Export needs a saved clip in every scene. Import from Google Drive first, then remove any scene with no match."}
        </p>
        {exporting ? (
          <p className="text-sm text-muted-foreground" role="status">
            This can take a few minutes. Leave this page open.
          </p>
        ) : null}
        {exportError ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {exportError}
          </p>
        ) : null}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download="retreat-video.mp4"
            className="text-sm font-medium text-primary underline"
          >
            Download retreat-video.mp4
          </a>
        ) : null}
        {exportNote ? (
          <p className="text-sm text-muted-foreground" role="status">
            {exportNote}
          </p>
        ) : null}
      </div>
    </div>
  )
}
