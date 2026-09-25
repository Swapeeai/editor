"use client"

import { useEffect, useState } from "react"
import type { ProjectId } from "@/lib/projects"
import type { SavedMedia } from "@/lib/saved-media"

export type ProjectMediaState = {
  projectId: ProjectId
  status: "loading" | "ready" | "error"
  configured: boolean
  items: SavedMedia[]
  error: string | null
}

export function useProjectMedia(projectId: ProjectId): ProjectMediaState & { reload: () => void } {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<ProjectMediaState>({
    projectId,
    status: "loading",
    configured: false,
    items: [],
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/media?project=${projectId}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          configured?: boolean
          items?: SavedMedia[]
          error?: string
        }
        if (!response.ok) {
          throw new Error(body.error || "Could not load saved files.")
        }
        setState({
          projectId,
          status: "ready",
          configured: Boolean(body.configured),
          items: Array.isArray(body.items) ? body.items : [],
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return
        }
        setState({
          projectId,
          status: "error",
          configured: false,
          items: [],
          error:
            error instanceof Error ? error.message : "Could not load saved files.",
        })
      })

    return () => controller.abort()
  }, [projectId, tick])

  const reload = () => setTick((value) => value + 1)

  if (state.projectId !== projectId) {
    return {
      projectId,
      status: "loading",
      configured: false,
      items: [],
      error: null,
      reload,
    }
  }

  return { ...state, reload }
}
