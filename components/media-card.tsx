"use client"

import { useEffect, useRef, useState } from "react"
import { CutClip } from "@/components/cut-clip"
import { ReviewMoments } from "@/components/review-moments"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { isProjectId, projects, type ProjectId } from "@/lib/projects"
import { formatSavedDate } from "@/lib/saved-media"
import type { SampleMedia } from "@/lib/sample-media"

export function MediaCard({
  item,
  onChanged,
  selected = false,
  onToggle,
  parts = [],
  focusTitle = false,
  onTabNext,
  highlighted = false,
  onShowInLibrary,
}: {
  item: SampleMedia
  onChanged?: () => void
  selected?: boolean
  onToggle?: () => void
  parts?: SampleMedia[]
  focusTitle?: boolean
  onTabNext?: () => void
  highlighted?: boolean
  onShowInLibrary?: (id: string) => void
}) {
  const kind = item.mediaType === "video" ? "Video" : "Photo"
  const playbackUrl = item.playbackUrl ?? null
  const others = projects.filter((project) => project.id !== item.projectId)
  const [target, setTarget] = useState<ProjectId>(others[0]?.id ?? "phuket")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const editingTitle = draft !== null || focusTitle
  const title = draft ?? item.title
  const [keywords, setKeywords] = useState(item.keywords ?? "")
  const uploaded = item.createdAt ? formatSavedDate(item.createdAt) : ""
  const keywordList = keywords
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  useEffect(() => {
    if (focusTitle) {
      titleRef.current?.focus()
      titleRef.current?.select()
    }
  }, [focusTitle])

  async function saveDetails(next: { title?: string; keywords?: string }) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/media/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...next }),
      })
      const body = (await response.json()) as { error?: string; title?: string | null }
      if (!response.ok) {
        throw new Error(body.error || "Could not save that change.")
      }
      setDraft(null)
      onChanged?.()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that change.")
      return false
    } finally {
      setBusy(false)
    }
  }

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
    <Card
      className={highlighted ? "h-full ring-2 ring-primary" : "h-full"}
      data-media-type={item.mediaType}
      data-project={item.projectId}
      data-media-id={item.id}
    >
      {playing && item.mediaType === "video" && playbackUrl ? (
        <video
          controls
          autoPlay
          src={playbackUrl}
          className="aspect-video w-full bg-black object-contain"
        />
      ) : item.poster && item.mediaType === "video" ? (
        <button type="button" className="block w-full" onClick={() => playbackUrl && setPlaying(true)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.poster}
            alt=""
            width={640}
            height={360}
            className="aspect-video w-full object-cover"
          />
        </button>
      ) : item.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.poster}
          alt=""
          width={640}
          height={360}
          className="aspect-video w-full object-cover"
        />
      ) : item.mediaType === "video" && playbackUrl ? (
        <button
          type="button"
          className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground"
          onClick={() => setPlaying(true)}
        >
          Play
        </button>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No preview
        </div>
      )}
      <CardHeader>
        {onToggle ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={selected} onChange={onToggle} />
            Select
          </label>
        ) : null}
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
        {editingTitle ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              void saveDetails({ title })
            }}
          >
            <Input
              ref={titleRef}
              value={title}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Tab" || event.shiftKey || !onTabNext) {
                  return
                }
                event.preventDefault()
                void saveDetails({ title }).then((saved) => {
                  if (saved) {
                    onTabNext()
                  }
                })
              }}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Enter saves. Tab saves and moves to the next name.</p>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                Save name
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" className="text-left" onClick={() => setDraft(item.title)}>
            <CardTitle>{item.title}</CardTitle>
            <span className="text-xs text-muted-foreground">Click to rename</span>
          </button>
        )}
        {keywordList.length > 0 ? (
          <p className="text-sm text-muted-foreground">Keywords: {keywordList.join(" · ")}</p>
        ) : null}
        {(item.folderNames ?? []).length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Folders: {(item.folderNames ?? []).join(" · ")}
          </p>
        ) : null}
        {item.sourceTitle ? (
          <p className="text-sm font-medium">Part of: {item.sourceTitle}</p>
        ) : null}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void saveDetails({ keywords })
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Keywords, separated by commas</span>
            <Input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="beach, pole trick, sunset"
              className="h-10"
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy}>
            Save keywords
          </Button>
        </form>
        {item.mediaType === "video" ? (
          <CutClip
            item={item}
            parts={parts}
            onChanged={() => onChanged?.()}
            onShowInLibrary={onShowInLibrary}
            onDeleteSource={async () => {
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
            }}
          />
        ) : null}
        {item.mediaType === "video" ? (
          <ReviewMoments
            mediaId={item.id}
            projectId={item.projectId}
            playbackUrl={playbackUrl}
          />
        ) : null}
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
