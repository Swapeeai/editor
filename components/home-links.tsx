"use client"

import { buttonVariants } from "@/components/ui/button"
import { ProjectLink } from "@/components/project-link"
import { cn } from "@/lib/utils"

export function HomeLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <ProjectLink
        href="/upload"
        className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
      >
        Upload
      </ProjectLink>
      <ProjectLink
        href="/library"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
      >
        Media Library
      </ProjectLink>
      <ProjectLink
        href="/review"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
      >
        Review
      </ProjectLink>
      <ProjectLink
        href="/create-video"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}
      >
        Create Video
      </ProjectLink>
    </div>
  )
}
