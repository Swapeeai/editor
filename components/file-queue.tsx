"use client"

import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SavedMedia } from "@/lib/saved-media"

export type QueueStatus = "waiting" | "uploading" | "done" | "skipped" | "failed"

export type QueueItem = {
  id: string
  name: string
  size: number | null
  status: QueueStatus
  percent: number | null
  detail: string
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function savedDetail(saved: { title: string; item: SavedMedia | null }) {
  const indexing =
    saved.item?.mediaType === "video" &&
    (saved.item.indexStatus === "pending" || saved.item.indexStatus === "indexing")
  if (indexing) {
    return `Saved as “${saved.title}”. Indexing for AI search…`
  }
  return `Saved as “${saved.title}”`
}

function statusText(item: QueueItem) {
  if (item.status === "uploading") {
    if (item.percent != null) {
      return `Uploading ${item.percent}%`
    }
    return item.detail || "Uploading…"
  }
  if (item.status === "waiting") {
    return "Waiting"
  }
  if (item.status === "done") {
    return item.detail || "Saved"
  }
  if (item.status === "skipped") {
    return `Skipped — ${item.detail}`
  }
  return `Failed — ${item.detail}`
}

export function FileQueue({
  items,
  onRemove,
}: {
  items: QueueItem[]
  onRemove?: (id: string) => void
}) {
  if (items.length === 0) {
    return null
  }
  const uploaded = items.filter((item) => item.status === "done").length
  const width = Math.round((uploaded / items.length) * 100)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium" role="status">
          {uploaded} of {items.length} uploaded
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${width}%` }} />
        </div>
      </div>
      <ul className="flex flex-col gap-2" aria-live="polite">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
            data-queue-status={item.status}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {item.size != null ? `${formatFileSize(item.size)} · ` : ""}
                {statusText(item)}
              </p>
            </div>
            {onRemove ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={item.status === "uploading"}
                onClick={() => onRemove(item.id)}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BatchSummary({
  projectId,
  projectName,
  saved,
  skipped,
  failed,
  indexing,
  onRetry,
  retrying,
}: {
  projectId: string
  projectName: string
  saved: number
  skipped: { name: string; detail: string }[]
  failed: number
  indexing: number
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary p-4">
      <p className="text-base font-semibold">
        Saved {saved} {saved === 1 ? "file" : "files"} to {projectName}
      </p>
      {skipped.length > 0 ? (
        <div className="text-sm">
          <p className="font-medium">
            Skipped {skipped.length} {skipped.length === 1 ? "file" : "files"}
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
            {skipped.map((item) => (
              <li key={`${item.name}-${item.detail}`} className="break-words">
                {item.name}: {item.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {failed > 0 ? (
        <p className="text-sm font-medium text-destructive">
          {failed} {failed === 1 ? "file" : "files"} failed.
        </p>
      ) : null}
      {indexing > 0 ? (
        <p className="text-sm text-muted-foreground">
          {indexing} {indexing === 1 ? "video is" : "videos are"} indexing for AI search.
          The library badge changes to Ready for AI search when that finishes.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/library?project=${projectId}`}
          className={cn(buttonVariants(), "h-8 px-2.5")}
        >
          View in library
        </Link>
        {failed > 0 && onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry} disabled={retrying}>
            {retrying ? "Retrying…" : "Retry failed"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
