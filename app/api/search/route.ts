import { NextResponse } from "next/server"
import { searchProjectMoments } from "@/lib/ai-search"
import { IndexSchemaError } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"
import { TwelveLabsError } from "@/lib/twelvelabs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as { projectId?: unknown; query?: unknown }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  const query = typeof record.query === "string" ? record.query.trim() : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }
  if (!query) {
    return NextResponse.json({ error: "Type what you want to find." }, { status: 400 })
  }

  try {
    const result = await searchProjectMoments(projectId, query)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof IndexSchemaError || error instanceof TwelveLabsError) {
      return NextResponse.json(
        { connected: true, moments: [], message: error.message },
        { status: 200 },
      )
    }
    const message = error instanceof Error ? error.message : "Could not search the footage."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
