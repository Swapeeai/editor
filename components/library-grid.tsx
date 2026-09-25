"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaCard } from "@/components/media-card"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia } from "@/components/use-project-media"
import { savedMediaAsClip, type SavedMedia } from "@/lib/saved-media"
import { filterMediaList, type MediaFilter } from "@/lib/sample-media"

const tabs: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "photo", label: "Photos" },
]

type SortOrder = "newest" | "oldest" | "name"

function sortItems(items: SavedMedia[], order: SortOrder) {
  const next = items.slice()
  if (order === "name") {
    next.sort((a, b) => a.title.localeCompare(b.title))
    return next
  }
  next.sort((a, b) => {
    const left = new Date(a.createdAt).getTime()
    const right = new Date(b.createdAt).getTime()
    return order === "oldest" ? left - right : right - left
  })
  return next
}

export function LibraryGrid() {
  const { query } = useSearchQuery()
  const { projectId, project } = useProject()
  const media = useProjectMedia(projectId)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const videos = media.items.filter((item) => item.mediaType === "video").length
  const photos = media.items.filter((item) => item.mediaType === "photo").length
  const source = sortItems(media.items, sortOrder).map(savedMediaAsClip)
  const items = filterMediaList(source, query, mediaFilter)
  const trimmed = query.trim()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-base text-muted-foreground">
          {media.status === "ready" && media.configured
            ? `${videos} ${videos === 1 ? "video" : "videos"} · ${photos} ${photos === 1 ? "photo" : "photos"}`
            : "Checking this library…"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="h-8 rounded-lg border border-input bg-background px-2"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {media.status === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load the library</CardTitle>
            <CardDescription>
              {media.error ?? "Try the page again in a moment."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : !media.configured ? (
        <Card>
          <CardHeader>
            <CardTitle>Not connected</CardTitle>
            <CardDescription>
              Add the Supabase values to .env.local and restart the app.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No files yet</CardTitle>
            <CardDescription>
              {trimmed
                ? `Nothing in ${project.name} matches “${trimmed}”.`
                : `Nothing is saved in ${project.name} yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} onChanged={media.reload} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
