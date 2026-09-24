"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useProject } from "@/components/project-provider"

export function ProjectLink({
  href,
  className,
  children,
  "aria-current": ariaCurrent,
}: {
  href: string
  className?: string
  children: ReactNode
  "aria-current"?: "page"
}) {
  const { projectId } = useProject()
  const join = href.includes("?") ? "&" : "?"

  return (
    <Link
      href={`${href}${join}project=${projectId}`}
      className={className}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  )
}
