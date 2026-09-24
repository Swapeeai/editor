"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { filterSampleMedia, mediaForProject } from "@/lib/sample-media"

export function SearchBox() {
  const pathname = usePathname()
  const { projectId, project } = useProject()
  const { query, setQuery } = useSearchQuery()
  const matchCount = filterSampleMedia(query, projectId).length
  const projectCount = mediaForProject(projectId).length
  const showMatchLink = pathname !== "/library" && query.trim().length > 0

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label htmlFor="library-search" className="text-sm font-medium">
        Search the sample library
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
        Only {project.name}. Matches titles, tags, and places. It does not look
        inside a photo or video.
        {showMatchLink ? (
          <>
            {" "}
            <Link
              href={`/library?project=${projectId}`}
              className="font-medium text-primary underline"
            >
              See {matchCount} of {projectCount} in the Media Library
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  )
}
