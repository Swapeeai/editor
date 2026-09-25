"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatTimestamp } from "@/lib/moment-timing"
import type { ProjectId } from "@/lib/projects"

type Proposal = {
  key: string
  start: number
  end: number
  label: string
  why: string
  decision: "pending" | "keep" | "reject"
  whole?: boolean
}

export function ReviewMoments({
  mediaId,
  projectId,
  playbackUrl,
}: {
  mediaId: string
  projectId: ProjectId
  playbackUrl: string | null
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  useEffect(() => {
    if (!taskId) {
      return
    }
    let stopped = false
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/moments/review?task=${encodeURIComponent(taskId)}`)
          const body = (await response.json()) as {
            error?: string
            status?: string
            note?: string
            moments?: Array<{ start: number; end: number; label: string; why: string }>
          }
          if (stopped) {
            return
          }
          if (!response.ok || body.error) {
            setError(body.error || "Could not check the review.")
            setTaskId(null)
            setBusy(false)
            return
          }
          if (body.status === "ready" || body.status === "failed") {
            setTaskId(null)
            setBusy(false)
            setNote(body.note ?? null)
            setProposals(
              (body.moments ?? []).map((moment, index) => ({
                key: `${moment.start}-${index}`,
                start: moment.start,
                end: moment.end,
                label: moment.label,
                why: moment.why,
                decision: "pending",
              })),
            )
            if ((body.moments ?? []).length === 0) {
              setError("No strong moments came back. You can still keep the whole video.")
            }
          }
        } catch {
          if (!stopped) {
            setError("Could not check the review.")
            setTaskId(null)
            setBusy(false)
          }
        }
      })()
    }, 4000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [taskId])

  async function startReview() {
    setOpen(true)
    setBusy(true)
    setError(null)
    setSaved(null)
    setNote(null)
    setProposals([])
    try {
      const response = await fetch("/api/moments/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mediaId }),
      })
      const body = (await response.json()) as {
        error?: string
        taskId?: string
        status?: string
        note?: string
        moments?: Array<{ start: number; end: number; label: string; why: string }>
      }
      if (!response.ok || body.error) {
        throw new Error(body.error || "Could not review this video.")
      }
      if (body.taskId) {
        setTaskId(body.taskId)
        setNote("Looking for the strongest moments…")
        return
      }
      setBusy(false)
      setNote(body.note ?? null)
      setProposals(
        (body.moments ?? []).map((moment, index) => ({
          key: `${moment.start}-${index}`,
          start: moment.start,
          end: moment.end,
          label: moment.label,
          why: moment.why,
          decision: "pending",
        })),
      )
    } catch (caught) {
      setBusy(false)
      setError(caught instanceof Error ? caught.message : "Could not review this video.")
    }
  }

  function keepWhole() {
    const end = duration != null && duration > 0 ? duration : 0
    setProposals([
      {
        key: "whole",
        start: 0,
        end,
        label: "Whole video",
        why: "The whole video is kept.",
        decision: "keep",
        whole: true,
      },
    ])
    setNote("The whole video will be saved as one moment.")
  }

  async function saveKept() {
    const kept = proposals.filter(
      (item) => item.decision === "keep" && (item.whole || item.end > item.start),
    )
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const response = await fetch("/api/moments/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mediaId,
          projectId,
          segments: kept.map((item) => ({
            start: item.start,
            end: item.whole && !(item.end > item.start) ? null : item.end,
            label: item.label,
          })),
        }),
      })
      const body = (await response.json()) as { error?: string; saved?: number }
      if (!response.ok || body.error) {
        throw new Error(body.error || "Could not save the moments.")
      }
      setSaved(
        body.saved
          ? `Saved ${body.saved} ${body.saved === 1 ? "moment" : "moments"}. Create Video will use these first.`
          : "Cleared the saved moments for this video.",
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the moments.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={() => void startReview()} disabled={busy}>
        {busy ? "Reviewing…" : "Review moments"}
      </Button>
      {open ? (
        <div className="flex flex-col gap-2">
          {playbackUrl ? (
            <video
              muted
              playsInline
              preload="metadata"
              src={playbackUrl}
              className="hidden"
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            />
          ) : null}
          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
          {proposals.map((proposal) => (
            <div key={proposal.key} className="flex flex-col gap-2 rounded-lg border p-2">
              {playbackUrl ? (
                <video
                  muted
                  playsInline
                  preload="metadata"
                  src={playbackUrl}
                  className="aspect-video w-full rounded-lg bg-black object-contain"
                  onLoadedMetadata={(event) => {
                    event.currentTarget.currentTime = proposal.start
                  }}
                />
              ) : null}
              <p className="text-sm font-medium">{proposal.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatTimestamp(proposal.start)}–{formatTimestamp(proposal.end)}
                {proposal.why ? ` · ${proposal.why}` : ""}
              </p>
              {proposal.decision === "keep" ? (
                <div className="flex flex-wrap gap-2">
                  <label className="text-sm">
                    Start
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={proposal.start}
                      className="mt-1 h-9 w-24"
                      onChange={(event) => {
                        const start = Number(event.target.value)
                        setProposals((current) =>
                          current.map((item) =>
                            item.key === proposal.key ? { ...item, start: Number.isFinite(start) ? start : 0 } : item,
                          ),
                        )
                      }}
                    />
                  </label>
                  <label className="text-sm">
                    End
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={proposal.end}
                      className="mt-1 h-9 w-24"
                      onChange={(event) => {
                        const end = Number(event.target.value)
                        setProposals((current) =>
                          current.map((item) =>
                            item.key === proposal.key ? { ...item, end: Number.isFinite(end) ? end : item.end } : item,
                          ),
                        )
                      }}
                    />
                  </label>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={proposal.decision === "keep" ? "default" : "outline"}
                  onClick={() =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.key === proposal.key ? { ...item, decision: "keep" } : item,
                      ),
                    )
                  }
                >
                  Keep
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.key === proposal.key ? { ...item, decision: "keep" } : item,
                      ),
                    )
                  }
                >
                  Trim
                </Button>
                <Button
                  type="button"
                  variant={proposal.decision === "reject" ? "default" : "outline"}
                  onClick={() =>
                    setProposals((current) =>
                      current.map((item) =>
                        item.key === proposal.key ? { ...item, decision: "reject" } : item,
                      ),
                    )
                  }
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={keepWhole}>
              Keep whole video
            </Button>
            <Button type="button" onClick={() => void saveKept()} disabled={busy}>
              Save kept moments
            </Button>
          </div>
          {saved ? <p className="text-sm text-muted-foreground">{saved}</p> : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
