"use client"

import { useEffect, useMemo, useState } from "react"
import { SchemaBanner } from "@/components/schema-banner"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useProject } from "@/components/project-provider"
import { useProjectMedia, type LibraryFolder } from "@/components/use-project-media"
import type { SavedMedia } from "@/lib/saved-media"

type ReviewFilter = "needs" | "all"

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json()) as { error?: string }
  if (!response.ok || body.error) {
    throw new Error(body.error || "That did not work.")
  }
}

function folderIdsFor(item: SavedMedia, folders: LibraryFolder[]) {
  const names = new Set((item.folderNames ?? []).map((name) => name.toLowerCase()))
  return folders.filter((folder) => names.has(folder.name.toLowerCase())).map((folder) => folder.id)
}

export function ReviewPass() {
  const { projectId } = useProject()
  return <ReviewBody key={projectId} />
}

function ReviewBody() {
  const { projectId, project } = useProject()
  const media = useProjectMedia(projectId)
  const [filter, setFilter] = useState<ReviewFilter>("needs")
  const [cursor, setCursor] = useState<{ filter: ReviewFilter; index: number }>({
    filter: "needs",
    index: 0,
  })
  const [draft, setDraft] = useState<{
    id: string
    title: string
    keywords: string
    folderIds: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const ordered = useMemo(
    () =>
      media.items
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [media.items],
  )
  const queue = filter === "needs" ? ordered.filter((item) => !item.reviewedAt) : ordered
  const reviewed = media.items.filter((item) => item.reviewedAt).length
  const index = cursor.filter === filter ? cursor.index : 0
  function setIndex(next: number) {
    setCursor({ filter, index: next })
  }
  const safeIndex = queue.length === 0 ? 0 : Math.min(index, queue.length - 1)
  const current = queue[safeIndex] ?? null
  const upcoming = queue[safeIndex + 1] ?? null
  const editing =
    current && draft?.id === current.id
      ? draft
      : current
        ? {
            id: current.id,
            title: current.title,
            keywords: current.keywords ?? "",
            folderIds: folderIdsFor(current, media.folders),
          }
        : null
  const title = editing?.title ?? ""
  const keywords = editing?.keywords ?? ""
  const folderIds = editing?.folderIds ?? []

  function updateDraft(next: Partial<{ title: string; keywords: string; folderIds: string[] }>) {
    if (!current || !editing) {
      return
    }
    setDraft({ ...editing, ...next, id: current.id })
  }

  function step(delta: number) {
    if (queue.length === 0) {
      return
    }
    setIndex(Math.max(0, Math.min(queue.length - 1, safeIndex + delta)))
    setNote(null)
  }

  async function save(advance: boolean) {
    if (!current || busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await postJson("/api/media/details", {
        id: current.id,
        title,
        keywords,
        reviewed: true,
      })
      if (media.foldersSchema) {
        await postJson("/api/folders/items", {
          projectId,
          mediaId: current.id,
          folderIds,
        })
      }
      setNote(`Saved “${title.trim() || current.title}”.`)
      media.reload()
      if (advance && filter === "all") {
        setIndex(safeIndex + 1)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this clip.")
    } finally {
      setBusy(false)
    }
  }

  async function removeCurrent() {
    if (!current || busy) {
      return
    }
    const ok = window.confirm(`Delete “${current.title}” from ${project.name}?`)
    if (!ok) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await postJson("/api/media/delete", { id: current.id })
      setNote(`Deleted “${current.title}”.`)
      media.reload()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this clip.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      if (event.key === "Enter") {
        event.preventDefault()
        void save(true)
        return
      }
      if (typing) {
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        step(1)
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        step(-1)
      } else if (event.key === "d" || event.key === "D" || event.key === "Delete") {
        event.preventDefault()
        void removeCurrent()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (media.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading clips…</p>
  }
  if (media.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Could not load the clips</CardTitle>
          <CardDescription>{media.error ?? "Try the page again in a moment."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  if (!media.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not connected</CardTitle>
          <CardDescription>Add the Supabase values in Settings, then come back.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Review {project.name}</h1>
        <p className="text-base font-medium">
          {reviewed} of {media.items.length} reviewed
        </p>
        <p className="text-sm text-muted-foreground">
          Arrow keys move between clips. Enter saves the name, keywords, and folders, and marks the clip reviewed.
          D deletes, after a confirm. Skip leaves it for later.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Review filter">
        <Button type="button" variant={filter === "needs" ? "default" : "outline"} onClick={() => setFilter("needs")}>
          Needs review
        </Button>
        <Button type="button" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All clips
        </Button>
      </div>

      {media.foldersSchema === false ? <SchemaBanner /> : null}

      {queue.length === 0 || !current ? (
        <Card>
          <CardHeader>
            <CardTitle>{filter === "needs" ? "Nothing left to review" : "No clips yet"}</CardTitle>
            <CardDescription>
              {filter === "needs"
                ? "Every clip in this project is marked reviewed. Switch to All clips to look again."
                : `Nothing is saved in ${project.name} yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {safeIndex + 1} of {queue.length}
            {filter === "needs" ? " still to review" : " in this pass"}
          </p>
          {current.mediaType === "video" && current.signedUrl ? (
            <video
              key={current.id}
              src={current.signedUrl}
              autoPlay
              muted
              controls
              playsInline
              className="max-h-[70vh] w-full rounded-xl bg-black object-contain"
            />
          ) : current.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.signedUrl}
              alt=""
              className="max-h-[70vh] w-full rounded-xl object-contain"
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              No preview
            </div>
          )}
          {upcoming?.mediaType === "video" && upcoming.signedUrl ? (
            <video src={upcoming.signedUrl} preload="auto" muted playsInline className="hidden" />
          ) : null}

          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void save(true)
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Title</span>
              <Input value={title} onChange={(event) => updateDraft({ title: event.target.value })} className="h-10" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Keywords, separated by commas</span>
              <Input
                value={keywords}
                onChange={(event) => updateDraft({ keywords: event.target.value })}
                placeholder="beach, pole trick, sunset"
                className="h-10"
              />
            </label>
            {media.folders.length > 0 ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Folders</legend>
                <div className="flex flex-col gap-2">
                  {media.folders.map((folder) => {
                    const checked = folderIds.includes(folder.id)
                    return (
                      <label key={folder.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            updateDraft({
                              folderIds: checked
                                ? folderIds.filter((id) => id !== folder.id)
                                : [...folderIds, folder.id],
                            })
                          }}
                        />
                        {folder.name}
                      </label>
                    )
                  })}
                </div>
                <p className="text-sm text-muted-foreground">A clip can sit in more than one folder.</p>
              </fieldset>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy}>
                Save
              </Button>
              <Button type="button" variant="outline" disabled={busy || safeIndex === 0} onClick={() => step(-1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || safeIndex >= queue.length - 1}
                onClick={() => step(1)}
              >
                Skip
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void removeCurrent()}>
                Delete
              </Button>
            </div>
          </form>
          {note ? (
            <p className="text-sm text-muted-foreground" role="status">
              {note}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
