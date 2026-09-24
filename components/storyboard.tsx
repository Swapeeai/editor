"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SampleMedia } from "@/lib/sample-media"

export type StoryScene = {
  id: string
  phrase: string
  media: SampleMedia | null
  reason: string
  announce: boolean
}

const SCENE_SECONDS = 5

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, "0")}`
}

export function sceneRange(index: number) {
  const start = index * SCENE_SECONDS
  return `${formatClock(start)}–${formatClock(start + SCENE_SECONDS)}`
}

export function Storyboard({
  scenes,
  titleText,
  campDate,
  campLocation,
  onMove,
  onRemove,
}: {
  scenes: StoryScene[]
  titleText: string
  campDate: string
  campLocation: string
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
}) {
  const total = formatClock(scenes.length * SCENE_SECONDS)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Running timeline</h2>
        <p className="text-sm text-muted-foreground">
          {scenes.length === 0
            ? "No scenes yet."
            : `${scenes.length} scenes · ${total} total. Each scene is ${SCENE_SECONDS} seconds.`}
        </p>
      </div>

      {scenes.length > 0 ? (
        <ol className="flex flex-col gap-2 sm:flex-row">
          {scenes.map((scene, index) => (
            <li
              key={scene.id}
              className="min-w-0 flex-1 rounded-lg bg-primary/10 px-3 py-2"
            >
              <p className="text-xs font-medium">{sceneRange(index)}</p>
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
                  Scene {index + 1} · {sceneRange(index)}
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
        <Button type="button" disabled>
          Export
        </Button>
        <p className="text-sm text-muted-foreground">
          Rendering comes once real media and the AI are connected.
        </p>
      </div>
    </div>
  )
}
