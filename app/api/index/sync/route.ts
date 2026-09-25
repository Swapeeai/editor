import { NextResponse } from "next/server"
import { syncProject } from "@/lib/ai-index"
import { IndexSchemaError } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }
  const rawProject = (body as { projectId?: unknown }).projectId
  const projectId = typeof rawProject === "string" ? rawProject : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }

  try {
    const result = await syncProject(projectId)
    if (!result.ok) {
      return NextResponse.json({ message: result.message, updated: 0 })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return NextResponse.json({ message: error.message, updated: 0 })
    }
    const message = error instanceof Error ? error.message : "Could not check indexing."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
