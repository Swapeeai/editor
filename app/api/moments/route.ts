import { NextResponse } from "next/server"
import { buildMomentScenes } from "@/lib/ai-search"
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

  const record = body as { projectId?: unknown; direction?: unknown }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  const direction = typeof record.direction === "string" ? record.direction : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }
  if (!direction.trim()) {
    return NextResponse.json({ error: "Type a direction first." }, { status: 400 })
  }

  try {
    const result = await buildMomentScenes(projectId, direction)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build the storyboard."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
