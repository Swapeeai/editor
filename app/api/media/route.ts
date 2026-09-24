import { NextResponse } from "next/server"
import { isProjectId } from "@/lib/projects"
import { rowToSavedMedia, type MediaRow } from "@/lib/saved-media"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("project")
  if (!isProjectId(projectId)) {
    return NextResponse.json(
      {
        error:
          "Pick a project first: Ibiza Pole Retreat, Phuket Pole Retreat, or Flirty Fitness.",
      },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ configured: false, items: [] })
  }

  const listed = await supabase
    .from("media_items")
    .select(
      "id, project_id, title, media_type, storage_path, mime_type, created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  if (listed.error) {
    return NextResponse.json(
      {
        error:
          "Could not read the library. Check that you ran supabase/schema.sql.",
      },
      { status: 502 },
    )
  }

  const rows = (listed.data ?? []) as MediaRow[]
  const signedByPath = new Map<string, string>()

  if (rows.length > 0) {
    const signed = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(
        rows.map((row) => row.storage_path),
        60 * 60,
      )

    for (const entry of signed.data ?? []) {
      if (entry.path && entry.signedUrl) {
        signedByPath.set(entry.path, entry.signedUrl)
      }
    }
  }

  return NextResponse.json({
    configured: true,
    items: rows.map((row) =>
      rowToSavedMedia(row, signedByPath.get(row.storage_path) ?? null),
    ),
  })
}
