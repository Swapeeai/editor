import { NextResponse } from "next/server"
import { IndexSchemaError } from "@/lib/media-db"
import { prepareProject } from "@/lib/ai-index"
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
    const result = await prepareProject(projectId)
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 200 })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return NextResponse.json({ error: error.message }, { status: 200 })
    }
    const message = error instanceof Error ? error.message : "Could not start indexing."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
