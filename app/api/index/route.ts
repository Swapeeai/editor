import { NextResponse } from "next/server"
import { prepareSelected } from "@/lib/ai-index"
import { IndexSchemaError } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"
import { productionGate } from "@/lib/production-gate"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const record = body as { projectId?: unknown; ids?: unknown }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }
  const ids = Array.isArray(record.ids)
    ? record.ids.filter((id): id is string => typeof id === "string" && UUID.test(id))
    : []
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Select the videos to prepare. Nothing was sent." },
      { status: 400 },
    )
  }

  try {
    const result = await prepareSelected(projectId, ids)
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
