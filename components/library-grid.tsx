"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaCard } from "@/components/media-card"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia } from "@/components/use-project-media"
import { savedMediaAsClip } from "@/lib/saved-media"
import {
  filterMediaList,
  mediaForProject,
  type MediaFilter,
} from "@/lib/sample-media"

const tabs: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "photo", label: "Photos" },
]

export function LibraryGrid() {
  const { query } = useSearchQuery()
  const { projectId, project } = useProject()
  const media = useProjectMedia(projectId)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")

  const usingSamples =
    media.status !== "ready" || !media.configured || media.items.length === 0
  const source = usingSamples
    ? mediaForProject(projectId)
    : media.items.map(savedMediaAsClip)
  const items = filterMediaList(source, query, mediaFilter)
  const inThisTab = filterMediaList(source, "", mediaFilter).length
  const trimmed = query.trim()
  const noun =
    mediaFilter === "video"
      ? "videos"
      : mediaFilter === "photo"
        ? "photos"
        : "items"
  const kindLabel = usingSamples ? "sample" : "saved"

  let note = `Checking for saved files in ${project.name}…`
  if (media.status === "error") {
    note = `${media.error ?? "Could not load saved files."} Showing samples for ${project.name}.`
  } else if (media.status === "ready" && !media.configured) {
    note = `Supabase is not connected, so these are samples for ${project.name}.`
  } else if (media.status === "ready" && media.items.length === 0) {
    note = `No uploads for ${project.name} yet, so these are samples.`
  } else if (media.status === "ready") {
    note = trimmed
      ? `${project.name}. Showing ${items.length} of ${inThisTab} saved ${noun}.`
      : `${project.name}. ${inThisTab} saved ${noun}.`
  }

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

      <p className="text-sm text-muted-foreground" role="status">
        {media.status === "loading"
          ? note
          : usingSamples
            ? `${note} ${
                trimmed
                  ? `Showing ${items.length} of ${inThisTab} sample ${noun}.`
                  : `${inThisTab} sample ${noun}.`
              }`
            : note}
      </p>

      {media.status === "loading" ? null : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matches</CardTitle>
            <CardDescription>
              {trimmed
                ? `No ${kindLabel} ${noun} match “${trimmed}”.`
                : `No ${kindLabel} ${noun} yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} sample={usingSamples} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
