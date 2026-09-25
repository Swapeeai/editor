import { NextResponse } from "next/server"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again."

const CHUNK = 25

function idsOf(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((id): id is string => typeof id === "string" && UUID.test(id)))].slice(
    0,
    CHUNK,
  )
}

function cleanKeyword(value: string) {
  return value.replace(/[\u0000-\u001f]/g, "").trim().replace(/\s+/g, " ").slice(0, 80)
}

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

  const record = body as { action?: unknown; ids?: unknown; keyword?: unknown }
  const ids = idsOf(record.ids)
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one file." }, { status: 400 })
  }

  if (record.action === "keyword") {
    const keyword = typeof record.keyword === "string" ? cleanKeyword(record.keyword) : ""
    if (!keyword) {
      return NextResponse.json({ error: "Type a keyword." }, { status: 400 })
    }
    const listed = await supabase.from("media_items").select("id, keywords").in("id", ids)
    if (listed.error) {
      const missing = /keywords|schema cache|could not find/i.test(listed.error.message)
      return NextResponse.json(
        { error: missing ? SCHEMA_MESSAGE : "Could not read keywords." },
        { status: missing ? 400 : 502 },
      )
    }
    let updated = 0
    for (const row of listed.data ?? []) {
      const item = row as { id?: unknown; keywords?: unknown }
      if (typeof item.id !== "string") {
        continue
      }
      const current = typeof item.keywords === "string" ? item.keywords : ""
      const parts = current
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
      if (parts.some((part) => part.toLowerCase() === keyword.toLowerCase())) {
        updated += 1
        continue
      }
      const next = [...parts, keyword].join(", ").slice(0, 400)
      const saved = await supabase.from("media_items").update({ keywords: next }).eq("id", item.id)
      if (saved.error) {
        const missing = /keywords|schema cache|could not find/i.test(saved.error.message)
        return NextResponse.json(
          { error: missing ? SCHEMA_MESSAGE : "Could not save the keyword.", updated },
          { status: missing ? 400 : 502 },
        )
      }
      updated += 1
    }
    return NextResponse.json({ ok: true, updated })
  }

  if (record.action === "review") {
    const saved = await supabase
      .from("media_items")
      .update({ reviewed_at: new Date().toISOString() })
      .in("id", ids)
      .select("id")
    if (saved.error) {
      const missing = /reviewed_at|schema cache|could not find/i.test(saved.error.message)
      return NextResponse.json(
        { error: missing ? SCHEMA_MESSAGE : "Could not mark those files reviewed." },
        { status: missing ? 400 : 502 },
      )
    }
    return NextResponse.json({ ok: true, updated: saved.data?.length ?? 0 })
  }

  if (record.action === "delete") {
    const listed = await supabase.from("media_items").select("id, storage_path").in("id", ids)
    if (listed.error) {
      return NextResponse.json({ error: "Could not read those files." }, { status: 502 })
    }
    let deleted = 0
    const failed: string[] = []
    for (const row of listed.data ?? []) {
      const item = row as { id?: unknown; storage_path?: unknown }
      if (typeof item.id !== "string" || typeof item.storage_path !== "string") {
        continue
      }
      const removed = await supabase.storage.from(MEDIA_BUCKET).remove([item.storage_path])
      if (removed.error) {
        failed.push(item.id)
        continue
      }
      const gone = await supabase.from("media_items").delete().eq("id", item.id)
      if (gone.error) {
        failed.push(item.id)
        continue
      }
      deleted += 1
    }
    return NextResponse.json({
      ok: failed.length === 0,
      deleted,
      failed,
      error:
        failed.length > 0
          ? `${failed.length} ${failed.length === 1 ? "file" : "files"} could not be deleted.`
          : null,
    })
  }

  return NextResponse.json({ error: "That bulk action is not recognised." }, { status: 400 })
}
