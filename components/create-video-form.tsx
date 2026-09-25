"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useProject } from "@/components/project-provider"
import { useProjectMedia } from "@/components/use-project-media"
import type { ProjectId } from "@/lib/projects"
import { savedMediaAsClip, type SavedMedia } from "@/lib/saved-media"
import { mediaForProject, type SampleMedia } from "@/lib/sample-media"
import { Storyboard, type StoryScene } from "@/components/storyboard"

const examples: Record<
  ProjectId,
  { title: string; date: string; location: string; direction: string }
> = {
  ibiza: {
    title: "Ibiza Pole Retreat",
    date: "4–10 May 2026",
    location: "Ibiza, Spain",
    direction: "a word from the first file title then a word from the next file title",
  },
  phuket: {
    title: "Phuket Pole Retreat",
    date: "12–18 October 2026",
    location: "Phuket, Thailand",
    direction: "a word from the first file title then a word from the next file title",
  },
  flati: {
    title: "Flirty Fitness",
    date: "Mondays in October 2026",
    location: "Flirty studio",
    direction: "a word from the first file title then a word from the next file title",
  },
}

function phraseAnnouncesCamp(phrase: string) {
  const text = phrase.toLowerCase()
  return (
    text.includes("announce") ||
    text.includes("camp date") ||
    text.includes("date and place") ||
    text.includes("background")
  )
}

export function CreateVideoForm() {
  const { projectId } = useProject()
  return <CreateVideoFields key={projectId} />
}

function libraryForStoryboard(
  projectId: ProjectId,
  configured: boolean,
  items: SavedMedia[],
): { clips: SampleMedia[]; fromUploads: boolean } {
  if (configured && items.length > 0) {
    return {
      clips: items
        .filter((item) => item.projectId === projectId)
        .map(savedMediaAsClip),
      fromUploads: true,
    }
  }
  return { clips: mediaForProject(projectId), fromUploads: false }
}

function CreateVideoFields() {
  const { projectId, project } = useProject()
  const media = useProjectMedia(projectId)
  const example = examples[projectId]
  const [titleText, setTitleText] = useState("")
  const [campDate, setCampDate] = useState("")
  const [campLocation, setCampLocation] = useState("")
  const [direction, setDirection] = useState("")
  const [scenes, setScenes] = useState<StoryScene[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  function fillExample() {
    setTitleText(example.title)
    setCampDate(example.date)
    setCampLocation(example.location)
    setDirection(example.direction)
    setError(null)
    setNote(null)
  }

  async function buildStoryboard() {
    if (!direction.trim()) {
      setError("Type a direction first.")
      setScenes(null)
      return
    }

    setBuilding(true)
    setError(null)
    setNote(null)

    let configured = media.configured
    let items = media.items
    try {
      const response = await fetch(`/api/media?project=${projectId}`)
      const body = (await response.json()) as {
        configured?: boolean
        items?: SavedMedia[]
      }
      if (response.ok) {
        configured = Boolean(body.configured)
        items = Array.isArray(body.items) ? body.items : []
      }
    } catch {
      configured = false
      items = []
    }

    const library = libraryForStoryboard(projectId, configured, items)
    if (!library.fromUploads) {
      setBuilding(false)
      setError("Import videos first. There is nothing saved in this project yet.")
      setScenes(null)
      return
    }

    try {
      const response = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, direction }),
      })
      const body = (await response.json()) as {
        error?: string
        note?: string | null
        scenes?: Array<{
          phrase: string
          mediaId: string | null
          start: number | null
          end: number | null
          confidence: string | null
          source: "twelvelabs" | "titles" | "none"
          reason: string
        }>
      }
      if (!response.ok) {
        throw new Error(body.error || "Could not build the storyboard.")
      }
      const built = Array.isArray(body.scenes) ? body.scenes : []
      if (built.length === 0) {
        throw new Error("Add a few words about what you want to see.")
      }
      setNote(body.note ?? null)
      setScenes(
        built.map((scene, index) => ({
          id: `scene-${index}-${scene.mediaId ?? "none"}`,
          phrase: scene.phrase,
          media: library.clips.find((clip) => clip.id === scene.mediaId) ?? null,
          reason: scene.reason,
          announce: phraseAnnouncesCamp(scene.phrase),
          clipStart: typeof scene.start === "number" ? scene.start : 0,
          clipEnd: typeof scene.end === "number" ? scene.end : null,
          confidence: scene.confidence,
          source: scene.source,
        })),
      )
    } catch (caught) {
      setScenes(null)
      setError(caught instanceof Error ? caught.message : "Could not build the storyboard.")
    } finally {
      setBuilding(false)
    }
  }

  function moveScene(index: number, directionDelta: -1 | 1) {
    setScenes((current) => {
      if (!current) {
        return current
      }
      const target = index + directionDelta
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = current.slice()
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function removeScene(index: number) {
    setScenes((current) => current?.filter((_, itemIndex) => itemIndex !== index) ?? current)
  }

  function setClipStart(index: number, start: number) {
    const next = Number.isFinite(start) ? Math.max(0, start) : 0
    setScenes((current) =>
      current?.map((scene, itemIndex) => {
        if (itemIndex !== index) {
          return scene
        }
        const end = scene.clipEnd != null && next < scene.clipEnd ? scene.clipEnd : null
        return { ...scene, clipStart: next, clipEnd: end }
      }) ?? current,
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          buildStoryboard()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="video-title" className="text-sm font-medium">
            Title text
          </label>
          <Input
            id="video-title"
            value={titleText}
            onChange={(event) => setTitleText(event.target.value)}
            placeholder={example.title}
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="camp-date" className="text-sm font-medium">
              Camp date
            </label>
            <Input
              id="camp-date"
              value={campDate}
              onChange={(event) => setCampDate(event.target.value)}
              placeholder={example.date}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="camp-location" className="text-sm font-medium">
              Camp location
            </label>
            <Input
              id="camp-location"
              value={campLocation}
              onChange={(event) => setCampLocation(event.target.value)}
              placeholder={example.location}
              className="h-10"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="direction" className="text-sm font-medium">
            Direction
          </label>
          <Textarea
            id="direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            placeholder={example.direction}
            rows={5}
            className="min-h-28"
          />
          <p className="text-sm text-muted-foreground">
            Use the word “then” between moments. Scenes come only from {project.name}.
            {media.aiSearch === false
              ? " AI search not connected yet. Matching uses the title and file name."
              : media.aiSearch
                ? " Each phrase is searched inside this project’s footage."
                : ""}
          </p>
        </div>

        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={building}>
            {building ? "Building…" : "Build storyboard"}
          </Button>
          <Button type="button" variant="outline" onClick={fillExample}>
            Fill the example
          </Button>
        </div>
      </form>

      {scenes ? (
        <>
          {note ? (
            <p className="text-sm text-muted-foreground" role="status">
              {note}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              These scenes use moments found in {project.name}.
            </p>
          )}
          <Storyboard
            scenes={scenes}
            projectId={projectId}
            titleText={titleText}
            campDate={campDate}
            campLocation={campLocation}
            onMove={moveScene}
            onRemove={removeScene}
            onStartChange={setClipStart}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No storyboard yet. Type a direction, then choose Build storyboard.
        </p>
      )}
    </div>
  )
}
