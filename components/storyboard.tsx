"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatTimestamp } from "@/lib/moment-timing"
import type { ProjectId } from "@/lib/projects"
import type { SampleMedia } from "@/lib/sample-media"
import type { PlannedScene, StoryClip } from "@/lib/scene-plan"

export type VisibleClip = StoryClip & { media: SampleMedia | null }

export type StoryScene = Omit<PlannedScene, "clips"> & {
  id: string
  clips: VisibleClip[]
}

function sceneSeconds(scene: StoryScene) {
  if (scene.kind === "note") {
    return 0
  }
  if (scene.durationSeconds != null) {
    return scene.durationSeconds
  }
  return scene.clips.reduce((sum, clip) => sum + clip.seconds, 0)
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const rest = Math.round(safe % 60)
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

function rangeLabel(scenes: StoryScene[], index: number) {
  const scene = scenes[index]
  if (scene.kind === "note") {
    return "Not a scene"
  }
  if (scene.startSeconds != null && scene.endSeconds != null) {
    return `${formatClock(scene.startSeconds)}–${formatClock(scene.endSeconds)}`
  }
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
  onStartChange: (sceneIndex: number, clipIndex: number, start: number) => void
}) {
  const realScenes = scenes.filter((scene) => scene.kind === "scene")
  const unmatched = realScenes.filter((scene) => !scene.filled)
  const totalSeconds = realScenes.reduce((sum, scene) => sum + sceneSeconds(scene), 0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [exportNote, setExportNote] = useState<string | null>(null)
  const ready =
    realScenes.length > 0 &&
    unmatched.length === 0 &&
    realScenes.every((scene) =>
      scene.clips.every((clip) => clip.media && SAVED_ID.test(clip.media.id)),
    )

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
      const payload = realScenes.flatMap((scene) =>
        scene.clips.map((clip) => ({
          mediaId: clip.media?.id,
          startSeconds: clip.photo ? 0 : clip.start,
          endSeconds: clip.photo ? null : clip.end,
          durationSeconds: clip.seconds,
          caption: scene.caption,
        })),
      )
      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          titleText,
          date: campDate,
          location: campLocation,
          scenes: payload,
        }),
      })
      if (!response.ok) {
        const payloadBody = (await response.json()) as { error?: string }
        setExportError(payloadBody.error || "Could not make the video.")
        return
      }
      const blob = await response.blob()
      setDownloadUrl(URL.createObjectURL(blob))
      const note = response.headers.get("X-Export-Note")
      const saved = response.headers.get("X-Export-Saved")
      setExportNote(
        `${note ?? "This export has no sound and no music."} ${saved === "yes" ? "A copy was also saved in this project’s library." : ""}`.trim(),
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
          {realScenes.length === 0
            ? "No scenes yet."
            : `${realScenes.length} ${realScenes.length === 1 ? "scene" : "scenes"} · about ${formatClock(totalSeconds)}. Scene length comes from the brief. There is no sound and no music.`}
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
                {scene.kind === "note"
                  ? "Not a scene"
                  : scene.filled
                    ? scene.clips.map((clip) => clip.title).join(", ")
                    : "Unmatched"}
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
                  {scene.kind === "note"
                    ? "Not a scene"
                    : `Scene ${scenes.slice(0, index + 1).filter((item) => item.kind === "scene").length} · ${rangeLabel(scenes, index)}`}
                  {scene.label ? ` · ${scene.label}` : ""}
                </p>
                <CardTitle className="break-words">
                  {scene.kind === "note"
                    ? scene.label || "Note"
                    : scene.filled
                      ? scene.clips.map((clip) => clip.title).join(" · ")
                      : "Unmatched"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex min-w-0 flex-col gap-2 text-sm">
                  {scene.kind === "scene" ? (
                    <p className="break-words">
                      <span className="text-muted-foreground">Direction: </span>
                      {scene.phrase}
                    </p>
                  ) : (
                    <p className="break-words">{scene.phrase}</p>
                  )}
                  <p className={scene.filled ? "text-muted-foreground" : "font-medium text-destructive"}>
                    {scene.reason}
                  </p>
                  {scene.folderName ? (
                    <p>
                      <span className="text-muted-foreground">Folder: </span>
                      {scene.folderName}
                    </p>
                  ) : null}
                  {scene.durationSeconds != null ? (
                    <p>
                      <span className="text-muted-foreground">Length from the brief: </span>
                      {scene.durationSeconds} seconds
                    </p>
                  ) : null}
                  {scene.caption ? (
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="font-medium">On-screen text</p>
                      {scene.caption.split("\n").map((line) => (
                        <p key={line} className="break-words">
                          {line}
                        </p>
                      ))}
                      <p className="text-muted-foreground">
                        This text is burned into the picture. There is no sound and no music.
                      </p>
                    </div>
                  ) : null}
                  {scene.clips.map((clip, clipIndex) => (
                    <div key={`${clip.mediaId}-${clip.start}`} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row">
                      {clip.media?.mediaType === "video" && clip.media.playbackUrl ? (
                        <video
                          controls
                          src={clip.media.playbackUrl}
                          className="aspect-video w-full rounded-lg bg-black object-contain sm:w-40"
                          onLoadedMetadata={(event) => {
                            const video = event.currentTarget
                            if (clip.start > 0 && video.currentTime < clip.start) {
                              video.currentTime = clip.start
                            }
                          }}
                        />
                      ) : clip.media?.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={clip.media.poster}
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
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="font-medium">{clip.title}</p>
                        <p className="text-muted-foreground">
                          {clip.photo ? "Photo" : "Video"}
                          {clip.photo
                            ? ` · ${clip.seconds} seconds`
                            : ` · ${formatTimestamp(clip.start)}–${formatTimestamp(clip.end ?? clip.start + clip.seconds)}`}
                          {clip.confidence ? ` · Confidence: ${clip.confidence}` : ""}
                          {clip.source === "approved" ? " · Approved moment" : ""}
                        </p>
                        {!clip.photo ? (
                          <label className="flex flex-col gap-1">
                            <span className="text-muted-foreground">Start at second in this clip</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={clip.start}
                              onChange={(event) =>
                                onStartChange(index, clipIndex, Number(event.target.value))
                              }
                              className="h-10 w-28"
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => onMove(index, -1)} disabled={index === 0}>
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
                  <Button type="button" variant="outline" onClick={() => onRemove(index)}>
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
        {unmatched.length > 0 ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {unmatched.length === 1
              ? "1 scene is unmatched. Export will not make a video, and it will not guess a clip."
              : `${unmatched.length} scenes are unmatched. Export will not make a video, and it will not guess a clip.`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ready
              ? "Makes a vertical 1080×1920 MP4. Each scene keeps the length from the brief. There is no sound and no music. A plain title card is added at the start when you fill in the title."
              : "Export needs a saved clip in every scene."}
          </p>
        )}
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
          <a href={downloadUrl} download="retreat-video.mp4" className="text-sm font-medium text-primary underline">
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
