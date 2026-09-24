"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaCard } from "@/components/media-card"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { filterSampleMedia, type MediaFilter } from "@/lib/sample-media"

const tabs: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "photo", label: "Photos" },
]

export function LibraryGrid() {
  const { query } = useSearchQuery()
  const { projectId, project } = useProject()
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")
  const items = filterSampleMedia(query, projectId, mediaFilter)
  const inThisTab = filterSampleMedia("", projectId, mediaFilter).length
  const trimmed = query.trim()
  const noun =
    mediaFilter === "video"
      ? "videos"
      : mediaFilter === "photo"
        ? "photos"
        : "items"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Media type">
        {tabs.map((tab) => {
          const selected = mediaFilter === tab.id
          return (
            <Button
              key={tab.id}
              type="button"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => setMediaFilter(tab.id)}
            >
              {tab.label}
            </Button>
          )
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {project.name}.{" "}
        {trimmed
          ? `Showing ${items.length} of ${inThisTab} sample ${noun}.`
          : `${inThisTab} sample ${noun}.`}
      </p>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matches</CardTitle>
            <CardDescription>
              {trimmed
                ? `No sample ${noun} match “${trimmed}”. Try “laughing” or “food”.`
                : `No sample ${noun} yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
