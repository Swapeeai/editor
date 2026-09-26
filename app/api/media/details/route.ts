import { NextResponse } from "next/server"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { uniqueTitle } from "@/lib/unique-title"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Database update needed. Use the copy button in the library banner, paste the SQL in the Supabase SQL editor, and click Run."

function cleanTitle(value: string) {
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120)
}

function cleanKeywords(value: string) {
  return value
    .replace(/[\u0000-\u001f]/g, "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
    .slice(0, 400)
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

  const record = body as {
    id?: unknown
    title?: unknown
    keywords?: unknown
    reviewed?: unknown
  }
  const id = typeof record.id === "string" ? record.id : ""
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "That file could not be found." }, { status: 400 })
  }

  const changes: { title?: string; keywords?: string } = {}
  if (typeof record.title === "string") {
    const title = cleanTitle(record.title)
    if (!title) {
      return NextResponse.json({ error: "Type a name for this file." }, { status: 400 })
    }
    changes.title = title
  }
  if (typeof record.keywords === "string") {
    changes.keywords = cleanKeywords(record.keywords)
  }
  const markReviewed = record.reviewed === true
  if (!changes.title && changes.keywords == null && !markReviewed) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 })
  }

  if (changes.title) {
    const current = await supabase
      .from("media_items")
      .select("project_id")
      .eq("id", id)
      .maybeSingle()
    const projectId =
      current.data && typeof current.data.project_id === "string" ? current.data.project_id : ""
    if (projectId) {
      const others = await supabase
        .from("media_items")
        .select("title")
        .eq("project_id", projectId)
        .neq("id", id)
      if (!others.error) {
        const taken = (others.data ?? []).flatMap((row) =>
          typeof (row as { title?: unknown }).title === "string"
            ? [(row as { title: string }).title]
            : [],
        )
        changes.title = uniqueTitle(changes.title, taken)
      }
    }
    const renamed = await supabase
      .from("media_items")
      .update({ title: changes.title })
      .eq("id", id)
    if (renamed.error) {
      return NextResponse.json({ error: "Could not rename that file." }, { status: 502 })
    }
  }

  if (changes.keywords != null) {
    const tagged = await supabase
      .from("media_items")
      .update({ keywords: changes.keywords })
      .eq("id", id)
    if (tagged.error) {
      const missing = /schema cache|could not find|keywords/i.test(tagged.error.message)
      return NextResponse.json(
        {
          error: missing ? SCHEMA_MESSAGE : "Could not save the keywords.",
          title: changes.title ?? null,
        },
        { status: missing ? 400 : 502 },
      )
    }
  }

  if (markReviewed) {
    const reviewed = await supabase
      .from("media_items")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", id)
    if (reviewed.error) {
      const missing = /schema cache|could not find|reviewed_at/i.test(reviewed.error.message)
      return NextResponse.json(
        { error: missing ? SCHEMA_MESSAGE : "Could not mark that file reviewed." },
        { status: missing ? 400 : 502 },
      )
    }
  }

  return NextResponse.json({
    title: changes.title ?? null,
    keywords: changes.keywords ?? null,
    reviewed: markReviewed,
  })
}
