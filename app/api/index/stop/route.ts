import { NextResponse } from "next/server"
import { stopPending } from "@/lib/ai-index"
import { IndexSchemaError } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }
  const projectId = (body as { projectId?: unknown }).projectId
  if (typeof projectId !== "string" || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }

  try {
    const result = await stopPending(projectId)
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 200 })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return NextResponse.json({ error: error.message }, { status: 200 })
    }
    const message = error instanceof Error ? error.message : "Could not stop indexing."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
