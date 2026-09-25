"use client"

import { useCallback, useEffect, useState } from "react"
import type { ProjectId } from "@/lib/projects"
import type { SavedMedia } from "@/lib/saved-media"

export type LibraryFolder = {
  id: string
  name: string
  count: number
}

export type ProjectMediaState = {
  projectId: ProjectId
  status: "loading" | "ready" | "error"
  configured: boolean
  aiSearch: boolean | null
  indexSchema: boolean | null
  foldersSchema: boolean | null
  folders: LibraryFolder[]
  items: SavedMedia[]
  error: string | null
}

export function useProjectMedia(projectId: ProjectId): ProjectMediaState & { reload: () => void } {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<ProjectMediaState>({
    projectId,
    status: "loading",
    configured: false,
    aiSearch: null,
    indexSchema: null,
    foldersSchema: null,
    folders: [],
    items: [],
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/media?project=${projectId}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          configured?: boolean
          aiSearch?: boolean
          indexSchema?: boolean
          foldersSchema?: boolean
          folders?: LibraryFolder[]
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
          aiSearch: Boolean(body.aiSearch),
          indexSchema: Boolean(body.indexSchema),
          foldersSchema: Boolean(body.foldersSchema),
          folders: Array.isArray(body.folders) ? body.folders : [],
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
          aiSearch: null,
          indexSchema: null,
          foldersSchema: null,
          folders: [],
          items: [],
          error:
            error instanceof Error ? error.message : "Could not load saved files.",
        })
      })

    return () => controller.abort()
  }, [projectId, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])

  if (state.projectId !== projectId) {
    return {
      projectId,
      status: "loading",
      configured: false,
      aiSearch: null,
      indexSchema: null,
      foldersSchema: null,
      folders: [],
      items: [],
      error: null,
      reload,
    }
  }

  return { ...state, reload }
}
