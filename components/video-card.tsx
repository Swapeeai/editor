import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { SampleVideo } from "@/lib/sample-videos"

export function VideoCard({ video }: { video: SampleVideo }) {
  return (
    <Card className="h-full">
      {/* Poster art only. There is no video file for these samples. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.poster}
        alt=""
        width={640}
        height={360}
        className="aspect-video w-full object-cover"
      />
      <CardHeader>
        <CardTitle>{video.title}</CardTitle>
      </CardHeader>
    </Card>
  )
}
