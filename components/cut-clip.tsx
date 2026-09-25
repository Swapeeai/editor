"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SampleMedia } from "@/lib/sample-media"

function formatSeconds(value: number) {
  return (Math.round(value * 10) / 10).toFixed(1)
}

function defaultTitle(name: string, start: number, end: number) {
  return `${name} ${formatSeconds(start)}–${formatSeconds(end)}s`.slice(0, 120)
}

export function CutClip({
  item,
  parts,
  onChanged,
  onDeleteSource,
}: {
  item: SampleMedia
  parts: SampleMedia[]
  onChanged: () => void
  onDeleteSource: () => Promise<void>
}) {
  const playbackUrl = item.playbackUrl ?? ""
  const [open, setOpen] = useState(false)
  const [duration, setDuration] = useState(item.durationSeconds ?? 0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(item.durationSeconds && item.durationSeconds > 0 ? item.durationSeconds : 1)
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const title = customTitle ?? defaultTitle(item.title, start, end)
  const [progress, setProgress] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setStartValue(next: number) {
    const limit = duration > 0 ? duration : next + 1
    const safe = Math.max(0, Math.min(next, limit - 0.2))
    setStart(safe)
    if (end <= safe) {
      setEnd(Math.min(limit, safe + 0.2))
    }
  }

  function setEndValue(next: number) {
    const limit = duration > 0 ? duration : Math.max(next, start + 0.2)
    setEnd(Math.max(start + 0.2, Math.min(next, limit)))
  }

  async function savePart() {
    if (progress) {
      return
    }
    setProgress("Opening the video…")
    setError(null)
    setNote(null)
    try {
      const response = await fetch("/api/media/cut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, start, end, title }),
      })
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || "Could not cut that part.")
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let saved = false
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          break
        }
        buffer += decoder.decode(chunk.value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) {
            continue
          }
          const event = JSON.parse(line) as {
            progress?: string
            error?: string
            done?: boolean
            warning?: string | null
            mode?: string
          }
          if (event.error) {
            throw new Error(event.error)
          }
          if (event.progress) {
            setProgress(event.progress)
          }
          if (event.done) {
            saved = true
            const how = event.mode === "copy" ? "Copied the picture without re-encoding." : "Re-encoded this part so the cut is exact."
            setNote(event.warning ? `${how} ${event.warning}` : `${how} Saved “${title}”.`)
          }
        }
      }
      if (!saved) {
        throw new Error("Could not cut that part.")
      }
      setCustomTitle(null)
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cut that part.")
    } finally {
      setProgress(null)
    }
  }

  async function deleteOriginal() {
    const count = parts.length
    const kept =
      count === 0
        ? "No parts have been saved from it yet."
        : `${count} ${count === 1 ? "part" : "parts"} will stay in the library.`
    const ok = window.confirm(`Delete “${item.title}”? ${kept}`)
    if (!ok) {
      return
    }
    setError(null)
    try {
      await onDeleteSource()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the original.")
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Cut
        </Button>
        <p className="text-xs text-muted-foreground">
          Cut the useful parts before AI search. A short part uses fewer of the 600 minutes than the whole video.
        </p>
      </div>
    )
  }

  const max = duration > 0 ? duration : Math.max(end, 1)
  const startPercent = (start / max) * 100
  const endPercent = (end / max) * 100

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Cut a part</p>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={Boolean(progress)}>
          Close
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Save each piece you want to keep. Cutting before AI search uses fewer of the 600 minutes than indexing the whole video.
      </p>
      {playbackUrl ? (
        <video
          src={playbackUrl}
          controls
          className="max-h-80 w-full rounded-lg bg-black object-contain"
          onLoadedMetadata={(event) => {
            const length = event.currentTarget.duration
            if (Number.isFinite(length) && length > 0) {
              setDuration(length)
              setEnd((current: number) => (current <= 1 || current > length ? length : current))
            }
          }}
          onTimeUpdate={(event) => {
            const video = event.currentTarget
            if (video.currentTime > end) {
              video.pause()
              video.currentTime = end
            }
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No preview for this video.</p>
      )}
      <div className="flex flex-col gap-2">
        <div className="relative h-2 rounded-full bg-muted">
          <div
            className="absolute h-2 rounded-full bg-primary"
            style={{ left: `${startPercent}%`, width: `${Math.max(0, endPercent - startPercent)}%` }}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Start</span>
          <input
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={start}
            aria-label="Start"
            onChange={(event) => setStartValue(Number(event.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">End</span>
          <input
            type="range"
            min={0}
            max={max}
            step={0.1}
            value={Math.min(end, max)}
            aria-label="End"
            onChange={(event) => setEndValue(Number(event.target.value))}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Start seconds</span>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={Math.round(start * 10) / 10}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  setStartValue(next)
                }
              }}
              className="h-10"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">End seconds</span>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={Math.round(end * 10) / 10}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next)) {
                  setEndValue(next)
                }
              }}
              className="h-10"
            />
          </label>
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Name for this part</span>
        <Input
          value={title}
          onChange={(event) => setCustomTitle(event.target.value)}
          className="h-10"
        />
      </label>
      <Button type="button" onClick={() => void savePart()} disabled={Boolean(progress)}>
        {progress ? progress : "Save this part"}
      </Button>
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
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Parts from this video ({parts.length})</p>
        {parts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Save a part and it stays in the library even if you delete this video.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {parts.map((part) => (
              <li key={part.id} className="flex flex-col gap-1 sm:flex-row sm:items-center">
                {part.playbackUrl ? (
                  <video
                    src={part.playbackUrl}
                    controls
                    preload="metadata"
                    className="h-24 w-full rounded-lg bg-black object-contain sm:w-40"
                  />
                ) : null}
                <span className="text-sm">{part.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="button" variant="outline" onClick={() => void deleteOriginal()} disabled={Boolean(progress)}>
        Delete the original
      </Button>
    </div>
  )
}
