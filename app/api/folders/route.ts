import { NextResponse } from "next/server"
import { createFolder, deleteFolder, renameFolder } from "@/lib/folder-actions"
import { isProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
  if (!getSupabaseAdmin()) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as {
    action?: unknown
    projectId?: unknown
    id?: unknown
    name?: unknown
  }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json({ error: "Pick a project first." }, { status: 400 })
  }
  const name = typeof record.name === "string" ? record.name : ""
  const id = typeof record.id === "string" ? record.id : ""

  const result =
    record.action === "create"
      ? await createFolder(projectId, name)
      : record.action === "rename"
        ? await renameFolder(projectId, id, name)
        : record.action === "delete"
          ? await deleteFolder(projectId, id)
          : { ok: false as const, status: 400, error: "That folder action is not recognised." }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}
