"use client"

import { useEffect, useMemo, useState } from "react"
import { ConvertHeic } from "@/components/convert-heic"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MediaCard } from "@/components/media-card"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { useProjectMedia, type LibraryFolder } from "@/components/use-project-media"
import { savedMediaAsClip, type SavedMedia } from "@/lib/saved-media"
import { filterMediaList, type MediaFilter } from "@/lib/sample-media"

const tabs: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "photo", label: "Photos" },
]

const PAGE_SIZE = 24

type SortOrder = "newest" | "oldest" | "name"
type FolderView = "all" | "unsorted" | string

function sortItems(items: SavedMedia[], order: SortOrder) {
  const next = items.slice()
  if (order === "name") {
    next.sort((a, b) => a.title.localeCompare(b.title))
    return next
  }
  next.sort((a, b) => {
    const left = new Date(a.createdAt).getTime()
    const right = new Date(b.createdAt).getTime()
    return order === "oldest" ? left - right : right - left
  })
  return next
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = (await response.json()) as { error?: string; message?: string; ok?: boolean }
  if (!response.ok || body.error) {
    throw new Error(body.error || body.message || "That did not work.")
  }
  return body
}

async function runChunks(ids: string[], work: (chunk: string[]) => Promise<void>) {
  for (let index = 0; index < ids.length; index += 25) {
    await work(ids.slice(index, index + 25))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  }
}

function readVideoDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error("Could not read the length."))
    }, 20000)
    function cleanup() {
      window.clearTimeout(timer)
      video.removeAttribute("src")
      video.load()
    }
    video.onloadedmetadata = () => {
      const seconds = video.duration
      cleanup()
      if (Number.isFinite(seconds) && seconds > 0) {
        resolve(seconds)
      } else {
        reject(new Error("This video has no length."))
      }
    }
    video.onerror = () => {
      cleanup()
      reject(new Error("Could not read the length."))
    }
    video.src = url
  })
}

export function LibraryGrid() {
  const { projectId } = useProject()
  return <LibraryBrowser key={projectId} />
}

function LibraryBrowser() {
  const { query } = useSearchQuery()
  const { projectId, project } = useProject()
  const media = useProjectMedia(projectId)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [folderView, setFolderView] = useState<FolderView>("all")
  const [pageState, setPageState] = useState({ key: "", page: 0 })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [folderName, setFolderName] = useState("")
  const [rename, setRename] = useState("")
  const [bulkKeyword, setBulkKeyword] = useState("")
  const [bulkFolderId, setBulkFolderId] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quota, setQuota] = useState<{
    usedMinutes: number
    remainingMinutes: number
    limitMinutes: number
    message: string | null
  } | null>(null)

  const indexing = media.items.some(
    (item) => item.mediaType === "video" && item.indexStatus === "indexing",
  )
  const pending = media.items.some(
    (item) => item.mediaType === "video" && item.indexStatus === "pending",
  )
  const reload = media.reload

  const pageKey = `${query}|${mediaFilter}|${sortOrder}|${folderView}`
  const page = pageState.key === pageKey ? pageState.page : 0
  function setPage(next: number) {
    setPageState({ key: pageKey, page: next })
  }

  useEffect(() => {
    if (!media.aiSearch || !media.indexSchema || !indexing) {
      return
    }
    const timer = window.setInterval(() => {
      void fetch("/api/index/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, mode: "poll" }),
      }).finally(() => {
        reload()
      })
    }, 8000)
    return () => window.clearInterval(timer)
  }, [indexing, media.aiSearch, media.indexSchema, projectId, reload])

  useEffect(() => {
    if (!media.aiSearch || !media.indexSchema) {
      return
    }
    const controller = new AbortController()
    fetch("/api/index/quota", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          usedMinutes?: number
          remainingMinutes?: number
          limitMinutes?: number
          message?: string | null
        }
        if (!response.ok) {
          return
        }
        setQuota({
          usedMinutes: body.usedMinutes ?? 0,
          remainingMinutes: body.remainingMinutes ?? 0,
          limitMinutes: body.limitMinutes ?? 600,
          message: body.message ?? null,
        })
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [media.aiSearch, media.indexSchema, media.items, projectId])

  const videos = media.items.filter((item) => item.mediaType === "video").length
  const photos = media.items.filter((item) => item.mediaType === "photo").length
  const unsorted = media.items.filter((item) => (item.folderNames ?? []).length === 0).length
  const activeFolder = media.folders.find((folder) => folder.id === folderView) ?? null

  const filtered = useMemo(() => {
    const inFolder = sortItems(media.items, sortOrder).filter((item) => {
      if (folderView === "all") {
        return true
      }
      if (folderView === "unsorted") {
        return (item.folderNames ?? []).length === 0
      }
      return (item.folderNames ?? []).some(
        (name) => name.toLowerCase() === activeFolder?.name.toLowerCase(),
      )
    })
    return filterMediaList(inFolder.map(savedMediaAsClip), query, mediaFilter)
  }, [activeFolder?.name, folderView, media.items, mediaFilter, query, sortOrder])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const selectedIds = filtered.filter((item) => selected.has(item.id)).map((item) => item.id)
  const selectedToIndex = filtered.filter(
    (item) => selected.has(item.id) && item.mediaType === "video" && item.indexStatus !== "ready",
  )
  const trimmed = query.trim()

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function withBusy(work: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await work()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  async function createFolder() {
    await withBusy(async () => {
      await postJson("/api/folders", { action: "create", projectId, name: folderName })
      setFolderName("")
      setNote("Folder created. The clips stay where they are until you add them.")
      reload()
    })
  }

  async function renameFolder(folder: LibraryFolder) {
    await withBusy(async () => {
      await postJson("/api/folders", {
        action: "rename",
        projectId,
        id: folder.id,
        name: rename || folder.name,
      })
      setRename("")
      setNote(`Renamed to “${rename || folder.name}”.`)
      reload()
    })
  }

  async function removeFolder(folder: LibraryFolder) {
    const ok = window.confirm(
      `Delete the folder “${folder.name}”? The clips stay in the library.`,
    )
    if (!ok) {
      return
    }
    await withBusy(async () => {
      await postJson("/api/folders", { action: "delete", projectId, id: folder.id })
      setFolderView("all")
      setNote(`Deleted “${folder.name}”. The clips are still in the library.`)
      reload()
    })
  }

  async function addSelectedToFolder() {
    if (!bulkFolderId || selectedIds.length === 0) {
      return
    }
    await withBusy(async () => {
      let done = 0
      await runChunks(selectedIds, async (chunk) => {
        await postJson("/api/folders/items", { projectId, folderId: bulkFolderId, mediaIds: chunk })
        done += chunk.length
        setNote(`Adding to folder… ${done} of ${selectedIds.length}`)
      })
      setNote(`Added ${selectedIds.length} ${selectedIds.length === 1 ? "file" : "files"} to the folder.`)
      reload()
    })
  }

  async function addKeyword() {
    const keyword = bulkKeyword.trim()
    if (!keyword || selectedIds.length === 0) {
      return
    }
    await withBusy(async () => {
      let done = 0
      await runChunks(selectedIds, async (chunk) => {
        await postJson("/api/media/bulk", { action: "keyword", ids: chunk, keyword })
        done += chunk.length
        setNote(`Adding keyword… ${done} of ${selectedIds.length}`)
      })
      setBulkKeyword("")
      setNote(`Added “${keyword}” to ${selectedIds.length} ${selectedIds.length === 1 ? "file" : "files"}.`)
      reload()
    })
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      return
    }
    const ok = window.confirm(
      `Delete ${selectedIds.length} ${selectedIds.length === 1 ? "file" : "files"} from ${project.name}?`,
    )
    if (!ok) {
      return
    }
    await withBusy(async () => {
      let done = 0
      await runChunks(selectedIds, async (chunk) => {
        await postJson("/api/media/bulk", { action: "delete", ids: chunk })
        done += chunk.length
        setNote(`Deleting… ${done} of ${selectedIds.length}`)
      })
      setSelected(new Set())
      setNote(`Deleted ${selectedIds.length} ${selectedIds.length === 1 ? "file" : "files"}.`)
      reload()
    })
  }

  async function prepareSelected() {
    const chosen = filtered.filter(
      (item) => selected.has(item.id) && item.mediaType === "video" && item.indexStatus !== "ready",
    )
    if (chosen.length === 0) {
      setError("Select a video that is not already ready for AI search.")
      return
    }
    await withBusy(async () => {
      const lengths = new Map<string, number>()
      for (const item of chosen) {
        const known = media.items.find((entry) => entry.id === item.id)?.durationSeconds
        if (known && known > 0) {
          lengths.set(item.id, known)
          continue
        }
        if (!item.playbackUrl) {
          throw new Error(`“${item.title}” has no preview, so its length could not be read. Nothing was sent.`)
        }
        setNote(`Reading length… ${lengths.size + 1} of ${chosen.length}`)
        const seconds = await readVideoDuration(item.playbackUrl)
        lengths.set(item.id, seconds)
      }
      const pairs = [...lengths.entries()].map(([id, durationSeconds]) => ({ id, durationSeconds }))
      for (let index = 0; index < pairs.length; index += 25) {
        await postJson("/api/media/duration", { items: pairs.slice(index, index + 25) })
      }
      const selectedSeconds = [...lengths.values()].reduce((sum, seconds) => sum + seconds, 0)
      const selectedMinutes = Math.ceil(selectedSeconds / 60)
      const used = quota?.usedMinutes ?? 0
      const limit = quota?.limitMinutes ?? 600
      const remaining = Math.max(0, limit - used)
      if (selectedMinutes > remaining) {
        throw new Error(
          `That selection is about ${selectedMinutes} minutes, and about ${Math.ceil(used)} of ${limit} are already used. Nothing was sent.`,
        )
      }
      const ok = window.confirm(
        `Prepare ${chosen.length} ${chosen.length === 1 ? "video" : "videos"} for AI search?\n\nAbout ${selectedMinutes} minutes selected.\nAbout ${used} of ${limit} minutes already used (estimate).\nAbout ${Math.round(remaining)} minutes left.\n\nDeleted videos do not give these minutes back.`,
      )
      if (!ok) {
        setNote("Nothing was sent.")
        return
      }
      const body = await postJson("/api/index", {
        projectId,
        ids: chosen.map((item) => item.id),
      })
      setNote(body.message || "Indexing has started.")
      reload()
    })
  }

  async function continueIndexing() {
    await withBusy(async () => {
      const body = await postJson("/api/index/sync", { projectId, mode: "sync" })
      setNote(body.message || "Continuing the videos that were waiting.")
      reload()
    })
  }

  async function stopWaiting() {
    await withBusy(async () => {
      const body = await postJson("/api/index/stop", { projectId })
      setNote(body.message || "Stopped the videos that had not been sent.")
      reload()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-base text-muted-foreground">
          {media.status === "ready" && media.configured
            ? `${videos} ${videos === 1 ? "video" : "videos"} · ${photos} ${photos === 1 ? "photo" : "photos"}`
            : "Checking this library…"}
        </p>
        {media.aiSearch && quota ? (
          <p className="text-sm text-muted-foreground">
            About {quota.usedMinutes} of {quota.limitMinutes} indexing minutes used. This is an estimate.
            {quota.message ? ` ${quota.message}` : ""}
          </p>
        ) : null}
        {media.status === "ready" && media.configured && media.aiSearch === false ? (
          <p className="text-sm text-muted-foreground">AI search not connected yet</p>
        ) : null}
        {media.status === "ready" && media.configured && media.aiSearch && !media.indexSchema ? (
          <p className="text-sm text-muted-foreground">
            AI search is connected. Run supabase/schema-update.sql once in the Supabase SQL editor, then choose which videos to prepare.
          </p>
        ) : null}
        {media.status === "ready" && media.configured && media.foldersSchema === false ? (
          <p className="text-sm text-muted-foreground">
            Folders need supabase/schema-update.sql. Run it once in the Supabase SQL editor. It is safe if you already ran the earlier Twelve Labs SQL.
          </p>
        ) : null}
      </div>

      {media.foldersSchema ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Folders">
            <Button
              type="button"
              variant={folderView === "all" ? "default" : "outline"}
              onClick={() => setFolderView("all")}
            >
              All ({media.items.length})
            </Button>
            <Button
              type="button"
              variant={folderView === "unsorted" ? "default" : "outline"}
              onClick={() => setFolderView("unsorted")}
            >
              Unsorted ({unsorted})
            </Button>
            {media.folders.map((folder) => (
              <Button
                key={folder.id}
                type="button"
                variant={folderView === folder.id ? "default" : "outline"}
                onClick={() => {
                  setFolderView(folder.id)
                  setRename(folder.name)
                }}
              >
                {folder.name} ({folder.count})
              </Button>
            ))}
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault()
              void createFolder()
            }}
          >
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="New folder, such as Boat trip"
              className="h-10 sm:max-w-xs"
            />
            <Button type="submit" variant="outline" disabled={busy || !folderName.trim()}>
              Create folder
            </Button>
          </form>
          {activeFolder ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={rename}
                onChange={(event) => setRename(event.target.value)}
                aria-label="Folder name"
                className="h-10 sm:max-w-xs"
              />
              <Button type="button" variant="outline" disabled={busy} onClick={() => void renameFolder(activeFolder)}>
                Rename folder
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void removeFolder(activeFolder)}>
                Delete folder
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSelected(new Set(filtered.map((item) => item.id)))}
          >
            Select all
          </Button>
          <Button type="button" variant="outline" onClick={() => setSelected(new Set())}>
            Select none
          </Button>
          <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={bulkFolderId}
            onChange={(event) => setBulkFolderId(event.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-2"
            aria-label="Folder for selected files"
          >
            <option value="">Add to folder…</option>
            {media.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" disabled={busy || !bulkFolderId || selectedIds.length === 0} onClick={() => void addSelectedToFolder()}>
            Add to folder
          </Button>
          <Input
            value={bulkKeyword}
            onChange={(event) => setBulkKeyword(event.target.value)}
            placeholder="Keyword for selected"
            className="h-10 sm:max-w-xs"
          />
          <Button type="button" variant="outline" disabled={busy || !bulkKeyword.trim() || selectedIds.length === 0} onClick={() => void addKeyword()}>
            Add keyword
          </Button>
          <Button type="button" variant="outline" disabled={busy || selectedIds.length === 0} onClick={() => void deleteSelected()}>
            Delete selected
          </Button>
        </div>
        {media.aiSearch && media.indexSchema ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void prepareSelected()}>
              Prepare selected videos for AI search ({selectedToIndex.length})
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Cut a long video into the parts you need first. A short part uses fewer of the 600 minutes than the whole video.
            </p>
            {pending ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void continueIndexing()}>
                Continue
              </Button>
            ) : null}
            {pending ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void stopWaiting()}>
                Stop waiting videos
              </Button>
            ) : null}
          </div>
        ) : null}
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

      {media.status === "ready" && media.configured ? (
        <ConvertHeic projectId={projectId} items={media.items} onChanged={media.reload} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Media type">
          {tabs.map((tab) => {
            const pressed = mediaFilter === tab.id
            return (
              <Button
                key={tab.id}
                type="button"
                variant={pressed ? "default" : "outline"}
                aria-pressed={pressed}
                onClick={() => setMediaFilter(tab.id)}
              >
                {tab.label}
              </Button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="h-8 rounded-lg border border-input bg-background px-2"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      {media.status === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load the library</CardTitle>
            <CardDescription>{media.error ?? "Try the page again in a moment."}</CardDescription>
          </CardHeader>
        </Card>
      ) : !media.configured ? (
        <Card>
          <CardHeader>
            <CardTitle>Not connected</CardTitle>
            <CardDescription>Add the Supabase values to .env.local and restart the app.</CardDescription>
          </CardHeader>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No files yet</CardTitle>
            <CardDescription>
              {trimmed
                ? `Nothing in ${project.name} matches “${trimmed}”.`
                : folderView === "unsorted"
                  ? "Every file in this project is already in a folder."
                  : activeFolder
                    ? `Nothing is in “${activeFolder.name}” yet.`
                    : `Nothing is saved in ${project.name} yet.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visible.map((item) => (
              <li key={item.id}>
                <MediaCard
                  item={item}
                  parts={media.items
                    .filter((entry) => entry.sourceMediaId === item.id)
                    .map(savedMediaAsClip)}
                  selected={selected.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onChanged={media.reload}
                />
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Previous page
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {safePage + 1} of {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next page
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
