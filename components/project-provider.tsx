"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  isProjectId,
  projectById,
  type ProjectId,
} from "@/lib/projects"

// The chosen project is kept in the address (?project=ibiza)
// and in the browser, so a refresh stays on the same library.

const STORAGE_KEY = "retreat-content-project"
const DEFAULT_PROJECT: ProjectId = "ibiza"

type ProjectContextValue = {
  projectId: ProjectId
  project: ReturnType<typeof projectById>
  setProjectId: (id: ProjectId) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const param = searchParams.get("project")
  const projectId: ProjectId = isProjectId(param) ? param : DEFAULT_PROJECT

  useEffect(() => {
    if (isProjectId(param)) {
      localStorage.setItem(STORAGE_KEY, param)
      return
    }

    const saved = localStorage.getItem(STORAGE_KEY)
    const next: ProjectId = isProjectId(saved) ? saved : DEFAULT_PROJECT
    const params = new URLSearchParams(searchParams.toString())
    params.set("project", next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [param, pathname, router, searchParams])

  function setProjectId(next: ProjectId) {
    localStorage.setItem(STORAGE_KEY, next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("project", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <ProjectContext.Provider
      value={{ projectId, project: projectById(projectId), setProjectId }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const value = useContext(ProjectContext)
  if (!value) {
    throw new Error("useProject must be used inside ProjectProvider")
  }
  return value
}
