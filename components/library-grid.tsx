"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaCard } from "@/components/media-card"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia } from "@/components/use-project-media"
import { savedMediaAsClip } from "@/lib/saved-media"
import { filterMediaList, type MediaFilter } from "@/lib/sample-media"

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
  const source = media.items.map(savedMediaAsClip)
  const items = filterMediaList(source, query, mediaFilter)
  const trimmed = query.trim()

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

      {media.status === "loading" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Checking {project.name}…
        </p>
      ) : media.status === "error" ? (
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
              Add the Supabase values to .env.local and restart the app. Then
              import videos for {project.name}.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No videos yet</CardTitle>
            <CardDescription>
              {trimmed
                ? `Nothing in ${project.name} matches “${trimmed}”.`
                : `Import from Google Drive on the Upload page. These files belong to ${project.name}.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {project.name}. {items.length} saved{" "}
            {mediaFilter === "video" ? "videos" : mediaFilter === "photo" ? "photos" : "files"}.
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id}>
                <MediaCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
