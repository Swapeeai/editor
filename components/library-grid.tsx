"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchQuery } from "@/components/search-provider"
import { VideoCard } from "@/components/video-card"
import { filterSampleVideos, sampleVideos } from "@/lib/sample-videos"

export function LibraryGrid() {
  const { query } = useSearchQuery()
  const videos = filterSampleVideos(query)
  const trimmed = query.trim()

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {trimmed
          ? `Showing ${videos.length} of ${sampleVideos.length} sample videos.`
          : `${sampleVideos.length} sample videos.`}
      </p>

      {videos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No matches</CardTitle>
            <CardDescription>
              No sample titles match “{trimmed}”. Try “laughing” or “pole”.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoCard video={video} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
