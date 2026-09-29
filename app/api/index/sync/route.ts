import { NextResponse } from "next/server"
import { syncProject } from "@/lib/ai-index"
import { IndexSchemaError } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }
  const record = body as { projectId?: unknown; mode?: unknown }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }
  const mode = record.mode === "sync" ? "sync" : "poll"

  try {
    const result = await syncProject(projectId, mode)
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
