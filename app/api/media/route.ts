import { NextResponse } from "next/server"
import { isTwelveLabsConfigured } from "@/lib/twelvelabs"
import { listProjectItems, toPublicItem } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"

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

  const { getSupabaseAdmin } = await import("@/lib/supabase-admin")
  if (!getSupabaseAdmin()) {
    return NextResponse.json({
      configured: false,
      aiSearch: isTwelveLabsConfigured(),
      indexSchema: false,
      keywordsSchema: false,
      reviewedSchema: false,
      foldersSchema: false,
      folders: [],
      items: [],
    })
  }

  try {
    const listed = await listProjectItems(projectId)
    return NextResponse.json({
      configured: true,
      aiSearch: isTwelveLabsConfigured(),
      indexSchema: listed.indexSchema,
      keywordsSchema: listed.keywordsSchema,
      reviewedSchema: listed.reviewedSchema,
      foldersSchema: listed.foldersSchema,
      folders: listed.folders,
      items: listed.items.map(toPublicItem),
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not read the library. Check that you ran supabase/schema.sql."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
