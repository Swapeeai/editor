import { NextResponse } from "next/server"
import { readLibraryItem } from "@/lib/media-db"
import { isProjectId } from "@/lib/projects"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  createHighlightTask,
  isTwelveLabsConfigured,
  retrieveAsset,
  retrieveHighlightTask,
  searchIndex,
  TwelveLabsError,
} from "@/lib/twelvelabs"
import { ensureProjectIndex } from "@/lib/ai-index"
import { hitIsStrong } from "@/lib/moment-pick"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const REVIEW_PROMPTS = [
  "the most visually striking moment",
  "a person performing a pole trick",
  "a scenic beach, ocean, or outdoor view",
  "people laughing, clapping, or celebrating",
  "an instructor teaching a move",
]

async function searchFallback(projectId: string, videoId: string, mediaItemId: string) {
  const indexId = await ensureProjectIndex(projectId as "ibiza" | "phuket" | "flati")
  const moments = []
  const seen = new Set<string>()
  for (const prompt of REVIEW_PROMPTS) {
    const result = await searchIndex(indexId, prompt)
    for (const hit of result.hits) {
      if (!hitIsStrong(hit, result.thresholdApplied)) {
        continue
      }
      const sameVideo =
        hit.videoId === videoId ||
        hit.mediaItemId === mediaItemId
      if (!sameVideo) {
        continue
      }
      const key = `${hit.start.toFixed(1)}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      moments.push({
        start: hit.start,
        end: hit.end,
        label: prompt,
        why: "Found by searching this video.",
      })
    }
  }
  return moments.slice(0, 8)
}

export async function POST(request: Request) {
  if (!getSupabaseAdmin()) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }
  if (!isTwelveLabsConfigured()) {
    return NextResponse.json(
      { error: "AI search not connected yet. Add TWELVE_LABS_API_KEY, then restart the app." },
      { status: 400 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }
  const id = typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : ""
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "That video could not be found." }, { status: 400 })
  }

  let item: Awaited<ReturnType<typeof readLibraryItem>>
  try {
    item = await readLibraryItem(id)
  } catch {
    return NextResponse.json(
      { error: "Run supabase/schema-update.sql once in the Supabase SQL editor, then prepare this video." },
      { status: 400 },
    )
  }
  if (!item || item.mediaType !== "video") {
    return NextResponse.json({ error: "That file is not a video." }, { status: 400 })
  }

  if (item.twelveLabsAssetId) {
    try {
      const asset = await retrieveAsset(item.twelveLabsAssetId)
      if (asset.status === "ready") {
        const taskId = await createHighlightTask(item.twelveLabsAssetId)
        return NextResponse.json({ taskId, status: "processing" })
      }
    } catch (error) {
      if (!(error instanceof TwelveLabsError)) {
        const message = error instanceof Error ? error.message : "Could not start the review."
        return NextResponse.json({ error: message }, { status: 502 })
      }
    }
  }

  if (item.twelveLabsVideoId && item.indexStatus === "ready" && isProjectId(item.projectId)) {
    try {
      const moments = await searchFallback(item.projectId, item.twelveLabsVideoId, item.id)
      if (moments.length > 0) {
        return NextResponse.json({ status: "ready", moments, note: "These came from search, not a chapter summary." })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not review this video."
      return NextResponse.json({ error: message }, { status: 502 })
    }
  }

  return NextResponse.json(
    {
      error:
        "Prepare this video for AI search first. Review moments runs after Twelve Labs has a copy of the file.",
    },
    { status: 400 },
  )
}

export async function GET(request: Request) {
  if (!isTwelveLabsConfigured()) {
    return NextResponse.json(
      { error: "AI search not connected yet. Add TWELVE_LABS_API_KEY, then restart the app." },
      { status: 400 },
    )
  }
  const taskId = new URL(request.url).searchParams.get("task") ?? ""
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(taskId)) {
    return NextResponse.json({ error: "That review could not be found." }, { status: 400 })
  }
  try {
    const task = await retrieveHighlightTask(taskId)
    if (task.status === "failed") {
      return NextResponse.json({
        status: "failed",
        error: "Twelve Labs could not review this video. Try again in a moment.",
      })
    }
    if (task.status !== "ready") {
      return NextResponse.json({ status: "processing", moments: [] })
    }
    return NextResponse.json({
      status: "ready",
      moments: task.moments,
      note: "Twelve Labs proposed these moments. Keep, trim, or reject each one.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check the review."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
