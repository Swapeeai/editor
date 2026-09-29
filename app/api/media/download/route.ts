import { NextResponse } from "next/server"
import { fileNameFromStoragePath } from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SIGNED_SECONDS = 5 * 60

function originalName(storagePath: string) {
  const name = fileNameFromStoragePath(storagePath).replace(/["\r\n\\/]/g, "").trim()
  return name || "download"
}

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

  const existing = await supabase
    .from("media_items")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle()
  if (existing.error || !existing.data || typeof existing.data.storage_path !== "string") {
    return NextResponse.json({ error: "That file is not in the library." }, { status: 404 })
  }

  const fileName = originalName(existing.data.storage_path)
  const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(existing.data.storage_path, SIGNED_SECONDS, {
    download: fileName,
  })
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Could not prepare that download." }, { status: 502 })
  }

  return NextResponse.json({ url: signed.data.signedUrl, fileName })
}
