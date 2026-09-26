import { NextResponse } from "next/server"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { patternTitles } from "@/lib/unique-title"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Database update needed. Use the copy button in the library banner, paste the SQL in the Supabase SQL editor, and click Run."

const CHUNK = 25

function idsOf(value: unknown, limit = CHUNK) {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((id): id is string => typeof id === "string" && UUID.test(id)))].slice(
    0,
    limit,
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

  const record = body as { action?: unknown; ids?: unknown; keyword?: unknown; pattern?: unknown }
  const ids = idsOf(record.ids, record.action === "rename" ? 400 : CHUNK)
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

  if (record.action === "rename") {
    const pattern = typeof record.pattern === "string" ? record.pattern.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 80) : ""
    if (!pattern) {
      return NextResponse.json({ error: "Type a name pattern." }, { status: 400 })
    }
    const chosen = await supabase.from("media_items").select("id, project_id").in("id", ids)
    if (chosen.error || !chosen.data) {
      return NextResponse.json({ error: "Could not read those files." }, { status: 502 })
    }
    const projectIds = [
      ...new Set(
        (chosen.data ?? []).flatMap((row) =>
          typeof (row as { project_id?: unknown }).project_id === "string"
            ? [(row as { project_id: string }).project_id]
            : [],
        ),
      ),
    ]
    const library = await supabase.from("media_items").select("id, title").in("project_id", projectIds)
    if (library.error) {
      return NextResponse.json({ error: "Could not read the other names." }, { status: 502 })
    }
    const selected = new Set(ids)
    const takenOutside = (library.data ?? []).flatMap((row) => {
      const item = row as { id?: unknown; title?: unknown }
      if (typeof item.id !== "string" || selected.has(item.id) || typeof item.title !== "string") {
        return []
      }
      return [item.title]
    })
    const titles = patternTitles(pattern, ids.length, takenOutside)
    let updated = 0
    for (const [index, id] of ids.entries()) {
      const saved = await supabase.from("media_items").update({ title: titles[index] }).eq("id", id)
      if (saved.error) {
        return NextResponse.json(
          { error: "Could not rename those files.", updated },
          { status: 502 },
        )
      }
      updated += 1
    }
    return NextResponse.json({ ok: true, updated, titles })
  }

  if (record.action === "delete") {
    const withThumb = await supabase.from("media_items").select("id, storage_path, thumbnail_path").in("id", ids)
    const listed = withThumb.error
      ? await supabase.from("media_items").select("id, storage_path").in("id", ids)
      : withThumb
    if (listed.error) {
      return NextResponse.json({ error: "Could not read those files." }, { status: 502 })
    }
    let deleted = 0
    const failed: string[] = []
    for (const row of listed.data ?? []) {
      const item = row as { id?: unknown; storage_path?: unknown; thumbnail_path?: unknown }
      if (typeof item.id !== "string" || typeof item.storage_path !== "string") {
        continue
      }
      const paths = [item.storage_path]
      if (typeof item.thumbnail_path === "string" && item.thumbnail_path) {
        paths.push(item.thumbnail_path)
      }
      const removed = await supabase.storage.from(MEDIA_BUCKET).remove(paths)
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
