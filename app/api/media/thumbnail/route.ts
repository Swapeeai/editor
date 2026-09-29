import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { thumbnailFromFile } from "@/lib/thumbnail"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { maxUploadBytes } from "@/lib/upload-limit"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SCHEMA_MESSAGE =
  "Database update needed. Use the copy button in the library banner, paste the SQL in the Supabase SQL editor, and click Run."

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

  const id = typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : ""
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "That file could not be found." }, { status: 400 })
  }

  const withThumb = await supabase
    .from("media_items")
    .select("id, project_id, media_type, storage_path, thumbnail_path, duration_seconds")
    .eq("id", id)
    .maybeSingle()
  const listed = withThumb.error
    ? await supabase
        .from("media_items")
        .select("id, project_id, media_type, storage_path, duration_seconds")
        .eq("id", id)
        .maybeSingle()
    : withThumb
  if (listed.error || !listed.data) {
    return NextResponse.json({ error: "That file is not in the library." }, { status: 404 })
  }

  const row = listed.data as {
    id: string
    project_id: string
    media_type: string
    storage_path: string
    thumbnail_path?: string | null
    duration_seconds?: number | null
  }
  if (row.media_type !== "video") {
    return NextResponse.json({ error: "Photos already show the picture." }, { status: 400 })
  }
  if (typeof row.thumbnail_path === "string" && row.thumbnail_path) {
    return NextResponse.json({ ok: true, skipped: true })
  }
  if (withThumb.error && /thumbnail_path|schema cache|could not find/i.test(withThumb.error.message)) {
    return NextResponse.json({ error: SCHEMA_MESSAGE, schema: true }, { status: 400 })
  }

  const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(row.storage_path, 60 * 30)
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Could not open that video." }, { status: 502 })
  }

  const dir = await mkdtemp(join(tmpdir(), "retreat-thumb-src-"))
  try {
    const downloaded = await fetch(signed.data.signedUrl)
    if (!downloaded.ok) {
      return NextResponse.json({ error: "Could not download that video." }, { status: 502 })
    }
    const bytes = Buffer.from(await downloaded.arrayBuffer())
    if (bytes.length > maxUploadBytes()) {
      return NextResponse.json({ error: "That video is too large to preview here." }, { status: 413 })
    }
    const filePath = join(dir, "video.mp4")
    await writeFile(filePath, bytes)
    const stored = await thumbnailFromFile(
      row.id,
      row.project_id,
      filePath,
      typeof row.duration_seconds === "number" ? row.duration_seconds : null,
    )
    if (!stored.ok) {
      return NextResponse.json(
        { error: stored.message, schema: stored.schema },
        { status: stored.schema ? 400 : 502 },
      )
    }
    return NextResponse.json({ ok: true, thumbnailUrl: stored.thumbnailUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not make a thumbnail."
    return NextResponse.json({ error: message }, { status: 502 })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
