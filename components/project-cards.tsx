"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { projects, type ProjectId } from "@/lib/projects"
import type { SavedMedia } from "@/lib/saved-media"

type Board = {
  status: "loading" | "ready" | "error"
  items: SavedMedia[]
}

export function ProjectCards() {
  const [boards, setBoards] = useState<Record<ProjectId, Board>>({
    ibiza: { status: "loading", items: [] },
    phuket: { status: "loading", items: [] },
    flati: { status: "loading", items: [] },
  })

  useEffect(() => {
    const controller = new AbortController()
    for (const project of projects) {
      fetch(`/api/media?project=${project.id}`, { signal: controller.signal })
        .then(async (response) => {
          const body = (await response.json()) as { items?: SavedMedia[]; error?: string }
          if (!response.ok) {
            throw new Error(body.error || "Could not load this project.")
          }
          setBoards((current) => ({
            ...current,
            [project.id]: {
              status: "ready",
              items: Array.isArray(body.items) ? body.items : [],
            },
          }))
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") {
            return
          }
          setBoards((current) => ({
            ...current,
            [project.id]: { status: "error", items: [] },
          }))
        })
    }
    return () => controller.abort()
  }, [])

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {projects.map((project) => {
        const board = boards[project.id]
        const videos = board.items.filter((item) => item.mediaType === "video").length
        const photos = board.items.filter((item) => item.mediaType === "photo").length
        const newest = board.items[0]
        const thumb = newest?.mediaType === "photo" ? newest.signedUrl : null
        return (
          <li key={project.id}>
            <Link href={`/library?project=${project.id}`} className="block h-full">
              <Card className="h-full overflow-hidden">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" className="aspect-video w-full object-cover" />
                ) : newest?.mediaType === "video" && newest.signedUrl ? (
                  <video
                    src={newest.signedUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted px-3 text-center text-sm text-muted-foreground">
                    {board.status === "loading"
                      ? "Checking…"
                      : newest
                        ? newest.title
                        : "No files yet"}
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    {board.status === "error"
                      ? "Could not load this project."
                      : board.status === "loading"
                        ? "Checking…"
                        : `${videos} ${videos === 1 ? "video" : "videos"} · ${photos} ${photos === 1 ? "photo" : "photos"}`}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
