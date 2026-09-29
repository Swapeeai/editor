import { NextResponse } from "next/server"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again."

export async function POST(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
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

  const items = (body as { items?: unknown }).items
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No lengths to save." }, { status: 400 })
  }

  let saved = 0
  for (const entry of items.slice(0, 25)) {
    const record = entry as { id?: unknown; durationSeconds?: unknown }
    const id = typeof record.id === "string" ? record.id : ""
    const seconds = Number(record.durationSeconds)
    if (!UUID.test(id) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 60 * 60 * 6) {
      continue
    }
    const updated = await supabase
      .from("media_items")
      .update({ duration_seconds: seconds })
      .eq("id", id)
    if (updated.error) {
      const missing = /duration_seconds|schema cache|could not find/i.test(updated.error.message)
      return NextResponse.json(
        { error: missing ? SCHEMA_MESSAGE : "Could not save the video length.", saved },
        { status: missing ? 400 : 502 },
      )
    }
    saved += 1
  }

  return NextResponse.json({ ok: true, saved })
}
