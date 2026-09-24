"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { findMoments } from "@/lib/find-moments"
import { Storyboard, type StoryScene } from "@/components/storyboard"

const example = {
  title: "Phuket Pole Camp",
  date: "12–18 October 2026",
  location: "Phuket, Thailand",
  direction:
    "announce the camp date and place over a Phuket background, then a dynamic pole trick, then someone clapping, then teaching, then instructors, then food.",
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
  const [titleText, setTitleText] = useState("")
  const [campDate, setCampDate] = useState("")
  const [campLocation, setCampLocation] = useState("")
  const [direction, setDirection] = useState("")
  const [scenes, setScenes] = useState<StoryScene[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function fillExample() {
    setTitleText(example.title)
    setCampDate(example.date)
    setCampLocation(example.location)
    setDirection(example.direction)
    setError(null)
  }

  function buildStoryboard() {
    if (!direction.trim()) {
      setError("Type a direction first.")
      setScenes(null)
      return
    }

    const matches = findMoments(direction)
    if (matches.length === 0) {
      setError("Add a few words about what you want to see.")
      setScenes(null)
      return
    }

    setError(null)
    setScenes(
      matches.map((match, index) => ({
        id: `scene-${index}-${match.media?.id ?? "none"}`,
        phrase: match.phrase,
        media: match.media,
        reason: match.reason,
        announce: phraseAnnouncesCamp(match.phrase),
      })),
    )
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
            placeholder="Phuket Pole Camp"
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
              placeholder="12–18 October 2026"
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
              placeholder="Phuket, Thailand"
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
            Use the word “then” between moments. The page splits the direction
            there and picks a sample for each part.
          </p>
        </div>

        {error ? (
          <p className="text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit">Build storyboard</Button>
          <Button type="button" variant="outline" onClick={fillExample}>
            Fill the example
          </Button>
        </div>
      </form>

      {scenes ? (
        <Storyboard
          scenes={scenes}
          titleText={titleText}
          campDate={campDate}
          campLocation={campLocation}
          onMove={moveScene}
          onRemove={removeScene}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No storyboard yet. Type a direction, then choose Build storyboard.
        </p>
      )}
    </div>
  )
}
