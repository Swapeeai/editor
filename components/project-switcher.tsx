"use client"

import { Button } from "@/components/ui/button"
import { useProject } from "@/components/project-provider"
import { useSearchQuery } from "@/components/search-provider"
import { projects } from "@/lib/projects"

export function ProjectSwitcher() {
  const { projectId, setProjectId } = useProject()
  const { setQuery } = useSearchQuery()

  return (
    <div className="flex flex-col gap-2">
      <p id="project-label" className="text-sm font-medium">
        Project
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby="project-label">
        {projects.map((project) => {
          const selected = project.id === projectId
          return (
            <Button
              key={project.id}
              type="button"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => {
                if (project.id !== projectId) {
                  setQuery("")
                }
                setProjectId(project.id)
              }}
            >
              {project.name}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
