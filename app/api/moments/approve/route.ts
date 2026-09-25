import { NextResponse } from "next/server"
import { isProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again."

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as {
    id?: unknown
    projectId?: unknown
    segments?: unknown
  }
  const id = typeof record.id === "string" ? record.id : ""
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  if (!UUID.test(id) || !isProjectId(projectId)) {
    return NextResponse.json({ error: "That video could not be found." }, { status: 400 })
  }

  const item = await supabase
    .from("media_items")
    .select("id, project_id, media_type")
    .eq("id", id)
    .maybeSingle()
  if (item.error || !item.data) {
    return NextResponse.json({ error: "That video is no longer in the library." }, { status: 404 })
  }
  const row = item.data as { project_id?: string; media_type?: string }
  if (row.project_id !== projectId || row.media_type !== "video") {
    return NextResponse.json({ error: "That file is not a video in this project." }, { status: 400 })
  }

  const segments = Array.isArray(record.segments) ? record.segments : []
  const rows = []
  for (const segment of segments) {
    if (!segment || typeof segment !== "object") {
      continue
    }
    const entry = segment as { start?: unknown; end?: unknown; label?: unknown }
    const start = typeof entry.start === "number" ? entry.start : Number.NaN
    const end = typeof entry.end === "number" ? entry.end : null
    if (!Number.isFinite(start) || start < 0 || start > 60 * 60 * 4) {
      continue
    }
    const whole = end == null
    if (!whole && (!Number.isFinite(end) || end <= start)) {
      continue
    }
    const label = typeof entry.label === "string" ? entry.label.trim().slice(0, 120) : ""
    rows.push({
      media_item_id: id,
      project_id: projectId,
      start_seconds: start,
      end_seconds: whole ? null : end,
      label: label || null,
    })
  }

  const removed = await supabase.from("approved_segments").delete().eq("media_item_id", id)
  if (removed.error) {
    const missing = /schema cache|could not find|approved_segments/i.test(removed.error.message)
    return NextResponse.json(
      { error: missing ? SCHEMA_MESSAGE : "Could not save the moments." },
      { status: missing ? 400 : 502 },
    )
  }

  if (rows.length > 0) {
    const inserted = await supabase.from("approved_segments").insert(rows)
    if (inserted.error) {
      const missing = /schema cache|could not find|approved_segments/i.test(inserted.error.message)
      return NextResponse.json(
        { error: missing ? SCHEMA_MESSAGE : "Could not save the moments." },
        { status: missing ? 400 : 502 },
      )
    }
  }

  return NextResponse.json({ saved: rows.length })
}
