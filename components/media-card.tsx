"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { isProjectId, projects, type ProjectId } from "@/lib/projects"
import { formatSavedDate } from "@/lib/saved-media"
import type { SampleMedia } from "@/lib/sample-media"

export function MediaCard({
  item,
  onChanged,
}: {
  item: SampleMedia
  onChanged?: () => void
}) {
  const kind = item.mediaType === "video" ? "Video" : "Photo"
  const playbackUrl = item.playbackUrl ?? null
  const others = projects.filter((project) => project.id !== item.projectId)
  const [target, setTarget] = useState<ProjectId>(others[0]?.id ?? "phuket")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploaded = item.createdAt ? formatSavedDate(item.createdAt) : ""

  async function moveFile() {
    if (busy || target === item.projectId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/media/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, projectId: target }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(body.error || "Could not move that file.")
      }
      onChanged?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not move that file.")
    } finally {
      setBusy(false)
    }
  }

  async function deleteFile() {
    if (busy) {
      return
    }
    const ok = window.confirm(`Delete “${item.title}” from ${item.retreatName}?`)
    if (!ok) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/media/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(body.error || "Could not delete that file.")
      }
      onChanged?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="h-full" data-media-type={item.mediaType} data-project={item.projectId}>
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
            {item.retreatName}
          </span>
          <span className="text-xs text-muted-foreground">{kind}</span>
          {uploaded ? <span className="text-xs text-muted-foreground">{uploaded}</span> : null}
          {item.mediaType === "video" &&
          (item.indexStatus === "pending" || item.indexStatus === "indexing") ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              Indexing…
            </span>
          ) : null}
          {item.mediaType === "video" && item.indexStatus === "ready" ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
              Ready for AI search
            </span>
          ) : null}
          {item.mediaType === "video" && item.indexStatus === "failed" ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Failed
            </span>
          ) : null}
        </div>
        {item.mediaType === "video" && item.indexStatus === "failed" ? (
          <div className="flex flex-col items-start gap-1">
            {item.indexError ? (
              <p className="text-xs text-destructive">{item.indexError}</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setError(null)
                  try {
                    const response = await fetch("/api/index/retry", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: item.id }),
                    })
                    const body = (await response.json()) as { error?: string }
                    if (!response.ok || body.error) {
                      throw new Error(body.error || "Could not retry indexing.")
                    }
                    onChanged?.()
                  } catch (caught) {
                    setError(
                      caught instanceof Error ? caught.message : "Could not retry indexing.",
                    )
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Retry
            </Button>
          </div>
        ) : null}
        <CardTitle>{item.title}</CardTitle>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Move to project</span>
            <select
              value={target}
              onChange={(event) => {
                if (isProjectId(event.target.value)) {
                  setTarget(event.target.value)
                }
              }}
              disabled={busy}
              className="h-10 rounded-lg border border-input bg-background px-2"
            >
              {others.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={moveFile} disabled={busy}>
              {busy ? "Working…" : "Move"}
            </Button>
            <Button type="button" variant="outline" onClick={deleteFile} disabled={busy}>
              Delete
            </Button>
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </CardHeader>
    </Card>
  )
}
