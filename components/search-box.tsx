"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia } from "@/components/use-project-media"
import { savedMediaAsClip } from "@/lib/saved-media"
import { filterMediaList } from "@/lib/sample-media"

export function SearchBox() {
  const pathname = usePathname()
  const { projectId, project } = useProject()
  const { query, setQuery } = useSearchQuery()
  const media = useProjectMedia(projectId)
  const clips = media.items.map(savedMediaAsClip)
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
        placeholder="Search a file title"
        autoComplete="off"
        className="h-10 bg-background"
      />
      <p className="text-sm text-muted-foreground">
        Only {project.name}. Matches titles and file names. It does not look
        inside a video.
        {showMatchLink ? (
          <>
            {" "}
            <Link
              href={`/library?project=${projectId}`}
              className="font-medium text-primary underline"
            >
              See {matchCount} of {projectCount} saved files in the Media Library
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  )
}
