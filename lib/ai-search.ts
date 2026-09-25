import "server-only"

import { ensureProjectIndex } from "@/lib/ai-index"
import { findMoments, splitDirection } from "@/lib/find-moments"
import { listProjectItems, type LibraryItem } from "@/lib/media-db"
import { bestHit, confidenceLabel, hitIsStrong, type SearchHit } from "@/lib/moment-pick"
import type { ProjectId } from "@/lib/projects"
import { savedMediaAsClip } from "@/lib/saved-media"
import { isTwelveLabsConfigured, searchIndex, TwelveLabsError } from "@/lib/twelvelabs"

export type MomentScene = {
  phrase: string
  mediaId: string | null
  title: string | null
  start: number | null
  end: number | null
  confidence: string | null
  source: "twelvelabs" | "titles" | "none"
  reason: string
}

function titleScenes(direction: string, items: LibraryItem[]): MomentScene[] {
  const clips = items.map((item) => savedMediaAsClip(item))
  return findMoments(direction, clips).map((match) => ({
    phrase: match.phrase,
    mediaId: match.media?.id ?? null,
    title: match.media?.title ?? null,
    start: match.media?.mediaType === "video" ? 0 : 0,
    end: null,
    confidence: null,
    source: "titles" as const,
    reason: match.reason,
  }))
}

function resolveItem(hit: SearchHit, items: LibraryItem[]) {
  return (
    items.find((item) => {
      if (hit.mediaItemId && item.id === hit.mediaItemId) {
        return true
      }
      if (hit.videoId && item.twelveLabsVideoId === hit.videoId) {
        return true
      }
      if (hit.videoId && item.twelveLabsAssetId === hit.videoId) {
        return true
      }
      return false
    }) ?? null
  )
}

export async function searchProjectMoments(projectId: ProjectId, query: string) {
  if (!isTwelveLabsConfigured()) {
    return {
      connected: false as const,
      moments: [] as MomentScene[],
      message: "AI search not connected yet",
    }
  }

  const listed = await listProjectItems(projectId)
  if (!listed.indexSchema) {
    return {
      connected: true as const,
      moments: [] as MomentScene[],
      message:
        "Run supabase/schema-twelvelabs.sql once in the Supabase SQL editor, then try again.",
    }
  }

  const ready = listed.items.filter(
    (item) => item.mediaType === "video" && item.indexStatus === "ready",
  )
  if (ready.length === 0) {
    return {
      connected: true as const,
      moments: [] as MomentScene[],
      message: "No video in this project is ready for AI search yet.",
    }
  }

  const indexId = await ensureProjectIndex(projectId)
  const result = await searchIndex(indexId, query)
  const moments: MomentScene[] = []
  for (const hit of result.hits) {
    if (!hitIsStrong(hit, result.thresholdApplied)) {
      continue
    }
    const item = resolveItem(hit, listed.items)
    if (!item) {
      continue
    }
    moments.push({
      phrase: query,
      mediaId: item.id,
      title: item.title,
      start: hit.start,
      end: hit.end,
      confidence: confidenceLabel(hit, result.thresholdApplied),
      source: "twelvelabs",
      reason: `Found inside “${item.title}”.`,
    })
  }

  return { connected: true as const, moments, message: null }
}

export async function buildMomentScenes(projectId: ProjectId, direction: string) {
  const phrases = splitDirection(direction)
  if (phrases.length === 0) {
    return { error: "Add a few words about what you want to see." as const }
  }

  const listed = await listProjectItems(projectId)
  if (listed.items.length === 0) {
    return {
      error:
        "Import videos first. There is nothing saved in this project yet." as const,
    }
  }

  if (!isTwelveLabsConfigured()) {
    return {
      connected: false as const,
      mode: "titles" as const,
      note: "AI search not connected yet",
      scenes: titleScenes(direction, listed.items),
    }
  }

  if (!listed.indexSchema) {
    return {
      connected: true as const,
      mode: "titles" as const,
      note: "Run supabase/schema-twelvelabs.sql once in the Supabase SQL editor, then AI search can use your videos. Matching titles until then.",
      scenes: titleScenes(direction, listed.items),
    }
  }

  const videos = listed.items.filter(
    (item) => item.mediaType === "video" && !item.storagePath.includes("/exports/"),
  )
  const ready = videos.filter((item) => item.indexStatus === "ready")
  if (ready.length === 0) {
    return {
      connected: true as const,
      mode: "titles" as const,
      note: "No video in this project is ready for AI search yet. Matching titles until indexing finishes.",
      scenes: titleScenes(direction, listed.items),
    }
  }

  let indexId: string
  try {
    indexId = await ensureProjectIndex(projectId)
  } catch (error) {
    if (error instanceof TwelveLabsError) {
      return {
        connected: true as const,
        mode: "titles" as const,
        note: `${error.message} Matching titles until AI search works.`,
        scenes: titleScenes(direction, listed.items),
      }
    }
    throw error
  }

  const used = new Set<string>()
  const scenes: MomentScene[] = []

  for (const phrase of phrases) {
    let result: Awaited<ReturnType<typeof searchIndex>>
    try {
      result = await searchIndex(indexId, phrase)
    } catch (error) {
      const fallback = titleScenes(phrase, listed.items)[0]
      const detail = error instanceof Error ? error.message : "AI search failed."
      scenes.push({
        phrase,
        mediaId: fallback?.mediaId ?? null,
        title: fallback?.title ?? null,
        start: 0,
        end: null,
        confidence: null,
        source: "titles",
        reason: `${detail} The title was used instead.`,
      })
      continue
    }

    const hit = bestHit(result.hits, result.thresholdApplied, used)
    const item = hit ? resolveItem(hit, listed.items) : null
    if (!hit || !item) {
      scenes.push({
        phrase,
        mediaId: null,
        title: null,
        start: null,
        end: null,
        confidence: null,
        source: "none",
        reason: `No moment in this project matched “${phrase}” closely enough. Nothing was guessed.`,
      })
      continue
    }

    used.add(`${hit.mediaItemId || hit.videoId}:${hit.start.toFixed(2)}`)
    used.add(`${item.id}:${hit.start.toFixed(2)}`)
    scenes.push({
      phrase,
      mediaId: item.id,
      title: item.title,
      start: hit.start,
      end: hit.end,
      confidence: confidenceLabel(hit, result.thresholdApplied),
      source: "twelvelabs",
      reason: `Found inside “${item.title}”.`,
    })
  }

  return {
    connected: true as const,
    mode: "moments" as const,
    note: null,
    scenes,
  }
}
