import { NextResponse } from "next/server"
import { isTwelveLabsConfigured } from "@/lib/twelvelabs"
import { listProjectItems, toPublicItem } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
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
      thumbnailSchema: false,
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
      thumbnailSchema: listed.thumbnailSchema,
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
