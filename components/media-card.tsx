import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { SampleMedia } from "@/lib/sample-media"

export function MediaCard({ item }: { item: SampleMedia }) {
  const kind = item.mediaType === "video" ? "Video" : "Photo"
  const camp = item.isCurrent ? "Current camp" : "Past camp"

  return (
    <Card className="h-full" data-media-type={item.mediaType}>
      {/* Poster art only. There is no real photo or video file behind it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.poster}
        alt=""
        width={640}
        height={360}
        className="aspect-video w-full object-cover"
      />
      <CardHeader>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          {kind} · {camp}
        </p>
        <CardTitle>{item.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {item.retreatName} · {item.year}
        </p>
        <p className="text-sm text-muted-foreground">{item.location}</p>
        <p className="text-sm text-muted-foreground">
          Tags: {item.tags.join(", ")}
        </p>
      </CardHeader>
    </Card>
  )
}
