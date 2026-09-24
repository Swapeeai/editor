"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useSearchQuery } from "@/components/search-provider"
import { filterSampleMedia, sampleMedia } from "@/lib/sample-media"

export function SearchBox() {
  const pathname = usePathname()
  const { query, setQuery } = useSearchQuery()
  const matchCount = filterSampleMedia(query).length
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
        placeholder='Try "laughing" or "Phuket"'
        autoComplete="off"
        className="h-10 bg-background"
      />
      <p className="text-sm text-muted-foreground">
        Matches titles, tags, retreats, and places. It does not look inside a
        photo or video.
        {showMatchLink ? (
          <>
            {" "}
            <Link href="/library" className="font-medium text-primary underline">
              See {matchCount} of {sampleMedia.length} in the Media Library
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  )
}
