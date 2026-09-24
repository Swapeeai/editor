import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import type { SampleMedia } from "@/lib/sample-media"

export function MediaCard({
  item,
  sample = false,
}: {
  item: SampleMedia
  sample?: boolean
}) {
  const kind = item.mediaType === "video" ? "Video" : "Photo"
  const playbackUrl = item.playbackUrl ?? null

  return (
    <Card
      className="h-full"
      data-media-type={item.mediaType}
      data-project={item.projectId}
      data-source={sample ? "sample" : "upload"}
    >
      {item.mediaType === "video" && playbackUrl ? (
        <video
          controls
          src={playbackUrl}
          className="aspect-video w-full bg-black object-contain"
        />
      ) : item.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.poster}
          alt=""
          width={640}
          height={360}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No preview
        </div>
      )}
      <CardHeader>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          {kind}
          {sample ? " · Sample" : null}
        </p>
        <CardTitle>{item.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {item.retreatName} · {item.year}
        </p>
        <p className="text-sm text-muted-foreground">{item.location}</p>
        <p className="text-sm text-muted-foreground">
          {item.tags.length > 0
            ? `Tags: ${item.tags.join(", ")}`
            : "No tags yet. Search and Create Video use the title and file name."}
        </p>
      </CardHeader>
    </Card>
  )
}
