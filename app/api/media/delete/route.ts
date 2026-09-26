import { NextResponse } from "next/server"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  const id = typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : ""
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "That file could not be found." }, { status: 400 })
  }

  const withThumb = await supabase
    .from("media_items")
    .select("id, storage_path, thumbnail_path")
    .eq("id", id)
    .maybeSingle()
  const existing = withThumb.error
    ? await supabase.from("media_items").select("id, storage_path").eq("id", id).maybeSingle()
    : withThumb

  if (existing.error || !existing.data) {
    return NextResponse.json({ error: "That file is not in the library." }, { status: 404 })
  }

  const storagePath = String(existing.data.storage_path ?? "")
  const thumbnailPath =
    "thumbnail_path" in existing.data && typeof existing.data.thumbnail_path === "string"
      ? existing.data.thumbnail_path
      : ""
  const removed = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove(thumbnailPath ? [storagePath, thumbnailPath] : [storagePath])
  if (removed.error) {
    return NextResponse.json(
      { error: "Could not delete the file from Storage. It is still in the library." },
      { status: 502 },
    )
  }

  const deleted = await supabase.from("media_items").delete().eq("id", id)
  if (deleted.error) {
    return NextResponse.json(
      { error: "The file was removed from Storage, but the library row is still there. Refresh and try Delete again." },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
