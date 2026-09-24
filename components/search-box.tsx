"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia } from "@/components/use-project-media"
import { savedMediaAsClip } from "@/lib/saved-media"
import { filterMediaList, mediaForProject } from "@/lib/sample-media"

export function SearchBox() {
  const pathname = usePathname()
  const { projectId, project } = useProject()
  const { query, setQuery } = useSearchQuery()
  const media = useProjectMedia(projectId)
  const usingUploads =
    media.status === "ready" && media.configured && media.items.length > 0
  const clips = usingUploads
    ? media.items.map(savedMediaAsClip)
    : mediaForProject(projectId)
  const matchCount = filterMediaList(clips, query).length
  const projectCount = clips.length
  const showMatchLink = pathname !== "/library" && query.trim().length > 0

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor="library-search" className="text-sm font-medium">
        Search this project
      </label>
      <Input
        id="library-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder='Try "laughing" or "food"'
        autoComplete="off"
        className="h-10 bg-background"
      />
      <p className="text-sm text-muted-foreground">
        Only {project.name}. Matches titles, tags, places, and file names. It
        does not look inside a photo or video.
        {showMatchLink ? (
          <>
            {" "}
            <Link
              href={`/library?project=${projectId}`}
              className="font-medium text-primary underline"
            >
              See {matchCount} of {projectCount}{" "}
              {usingUploads ? "saved files" : "sample items"} in the Media
              Library
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  )
}
