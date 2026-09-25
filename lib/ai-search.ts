import "server-only"

import { ensureProjectIndex } from "@/lib/ai-index"
import { parseBrief, type BriefBlock } from "@/lib/brief"
import { rankPhrase } from "@/lib/find-moments"
import {
  listApprovedSegments,
  listProjectItems,
  type ApprovedSegment,
  type LibraryItem,
} from "@/lib/media-db"
import { confidenceLabel, hitIsStrong, type SearchHit } from "@/lib/moment-pick"
import { DEFAULT_VIDEO_SECONDS, MAX_MOMENT_SECONDS, PHOTO_SECONDS } from "@/lib/moment-timing"
import type { ProjectId } from "@/lib/projects"
import { packClips, type PlannedScene, type StoryClip } from "@/lib/scene-plan"
import { keywordTags, savedMediaAsClip } from "@/lib/saved-media"
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
        "Run supabase/schema-update.sql once in the Supabase SQL editor, then try again.",
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

function usableItems(items: LibraryItem[]) {
  return items.filter((item) => !item.storagePath.includes("/exports/"))
}

function clipKey(mediaId: string, start: number) {
  return `${mediaId}:${start.toFixed(1)}`
}

function overlaps(
  start: number,
  end: number,
  segment: ApprovedSegment,
) {
  const segmentEnd = segment.endSeconds ?? Number.POSITIVE_INFINITY
  return start < segmentEnd && end > segment.startSeconds
}

function keywordClip(
  item: LibraryItem,
  segment: ApprovedSegment | null,
  durationSeconds: number | null,
): StoryClip {
  const photo = item.mediaType === "photo"
  if (photo) {
    return {
      mediaId: item.id,
      title: item.title,
      photo: true,
      start: 0,
      end: null,
      confidence: null,
      source: segment ? "approved" : "titles",
      seconds: PHOTO_SECONDS,
    }
  }
  const start = segment?.startSeconds ?? 0
  const wholeVideo = segment != null && segment.endSeconds == null
  const available =
    segment?.endSeconds != null
      ? Math.min(MAX_MOMENT_SECONDS, segment.endSeconds - start)
      : wholeVideo
        ? Math.min(MAX_MOMENT_SECONDS, durationSeconds ?? DEFAULT_VIDEO_SECONDS)
        : Math.min(DEFAULT_VIDEO_SECONDS, durationSeconds ?? DEFAULT_VIDEO_SECONDS)
  const seconds = Math.max(0.5, available)
  return {
    mediaId: item.id,
    title: item.title,
    photo: false,
    start,
    end: start + seconds,
    confidence: null,
    source: segment ? "approved" : "titles",
    seconds,
  }
}

function rankedItems(query: string, items: LibraryItem[], extraTags: Map<string, string[]>) {
  const clips = items.map((item) => {
    const clip = savedMediaAsClip(item)
    const extra = extraTags.get(item.id) ?? []
    return { ...clip, tags: [...clip.tags, ...extra] }
  })
  return rankPhrase(query, clips)
}

function unmatchedReason(connected: boolean, aiActive: boolean) {
  if (!connected) {
    return "AI search not connected yet. No title or keyword matched this scene. Nothing was guessed."
  }
  if (!aiActive) {
    return "AI search is not ready for this project yet. No title or keyword matched this scene. Nothing was guessed."
  }
  return "No moment matched this scene closely enough. Nothing was guessed."
}

function sceneFromBlock(
  block: BriefBlock,
  clips: StoryClip[],
  connected: boolean,
  aiActive: boolean,
): PlannedScene {
  if (block.kind === "note") {
    return {
      kind: "note",
      label: block.label,
      phrase: block.query,
      caption: block.caption,
      durationSeconds: null,
      startSeconds: null,
      endSeconds: null,
      folderName: null,
      clips: [],
      filled: true,
      reason: "Not a scene. Style and closing notes are left out of the video.",
    }
  }
  const packed = packClips(block.durationSeconds, clips)
  let reason = unmatchedReason(connected, aiActive)
  if (packed.clips.length > 0 && packed.filled) {
    const names = [...new Set(packed.clips.map((clip) => clip.title))]
    reason =
      packed.clips.length === 1
        ? `Matched “${names[0]}”.`
        : `Matched ${packed.clips.length} clips: ${names.join(", ")}.`
  } else if (packed.clips.length > 0) {
    const covered = packed.clips.reduce((sum, clip) => sum + clip.seconds, 0)
    reason = `Only ${covered.toFixed(1)} seconds matched. This scene asks for ${block.durationSeconds} seconds, so it is not ready to export.`
  }
  return {
    kind: "scene",
    label: block.label,
    phrase: block.query,
    caption: block.caption,
    durationSeconds: block.durationSeconds,
    startSeconds: block.startSeconds,
    endSeconds: block.endSeconds,
    folderName: block.folderName,
    clips: packed.clips,
    filled: packed.filled,
    reason,
  }
}

export async function buildMomentScenes(projectId: ProjectId, direction: string) {
  const blocks = parseBrief(direction).filter((block) => block.kind === "note" || block.query || block.label)
  if (blocks.length === 0) {
    return { error: "Add a few words about what you want to see." as const }
  }

  const listed = await listProjectItems(projectId)
  if (listed.items.length === 0) {
    return {
      error:
        "Import videos first. There is nothing saved in this project yet." as const,
    }
  }

  const items = usableItems(listed.items)
  const approvals = await listApprovedSegments(projectId)
  const byItem = new Map<string, ApprovedSegment[]>()
  for (const segment of approvals.segments) {
    const list = byItem.get(segment.mediaItemId) ?? []
    list.push(segment)
    byItem.set(segment.mediaItemId, list)
  }
  const labelTags = new Map<string, string[]>()
  for (const [mediaId, segments] of byItem) {
    labelTags.set(
      mediaId,
      segments.flatMap((segment) => keywordTags(segment.label)),
    )
  }

  const connected = isTwelveLabsConfigured()
  let mode: "moments" | "titles" = "titles"
  let note: string | null = connected
    ? null
    : "AI search not connected yet. Scenes stay empty unless a title or keyword matches. Export will not guess a clip."
  let indexId: string | null = null

  if (connected && !listed.indexSchema) {
    note =
      "Run supabase/schema-update.sql once in the Supabase SQL editor, then AI search can use your videos. Until then, only a title or keyword match is used, and weak matches are left empty."
  } else if (connected && listed.indexSchema) {
    const ready = items.filter(
      (item) => item.mediaType === "video" && item.indexStatus === "ready",
    )
    if (ready.length === 0) {
      note =
        "No video in this project is ready for AI search yet. Only a title or keyword match is used, and weak matches are left empty."
    } else {
      try {
        indexId = await ensureProjectIndex(projectId)
        mode = "moments"
        note = approvals.ready
          ? "Approved moments are used first. A scene with no close match stays empty."
          : "A scene with no close match stays empty. Review moments on a video when you want Create Video to prefer those parts."
      } catch (error) {
        if (!(error instanceof TwelveLabsError)) {
          throw error
        }
        note = `${error.message} Only a title or keyword match is used, and weak matches are left empty.`
      }
    }
  }

  const useTitles = indexId == null
  const used = new Set<string>()
  const scenes: PlannedScene[] = []

  for (const block of blocks) {
    if (block.kind === "note") {
      scenes.push(sceneFromBlock(block, [], connected, Boolean(indexId)))
      continue
    }

    const pool = block.folderName
      ? items.filter((item) =>
          (item.folderNames ?? []).some(
            (name) => name.toLowerCase() === block.folderName?.toLowerCase(),
          ),
        )
      : items
    if (block.folderName && pool.length === 0) {
      scenes.push({
        ...sceneFromBlock(block, [], connected, Boolean(indexId)),
        filled: false,
        clips: [],
        reason: `No clips are in the folder “${block.folderName}”. Nothing was guessed.`,
      })
      continue
    }

    const candidates: StoryClip[] = []
    const seen = new Set<string>()

    const push = (clip: StoryClip) => {
      const key = clipKey(clip.mediaId, clip.start)
      if (used.has(key) || seen.has(key)) {
        return
      }
      seen.add(key)
      candidates.push(clip)
    }

    if (indexId && block.query) {
      try {
        const result = await searchIndex(indexId, block.query)
        const strong = result.hits
          .filter((hit) => hitIsStrong(hit, result.thresholdApplied))
          .slice()
          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
        for (const hit of strong) {
          const item = resolveItem(hit, pool)
          if (!item || item.mediaType !== "video") {
            continue
          }
          let start = hit.start
          let end = hit.end
          const mine = byItem.get(item.id) ?? []
          let source: StoryClip["source"] = "twelvelabs"
          if (mine.length > 0) {
            const segment = mine.find((entry) => overlaps(start, end, entry))
            if (!segment) {
              continue
            }
            start = Math.max(start, segment.startSeconds)
            if (segment.endSeconds != null) {
              end = Math.min(end, segment.endSeconds)
            }
            source = "approved"
          }
          if (!(end > start)) {
            continue
          }
          const seconds = Math.min(MAX_MOMENT_SECONDS, end - start)
          push({
            mediaId: item.id,
            title: item.title,
            photo: false,
            start,
            end: start + seconds,
            confidence: confidenceLabel(hit, result.thresholdApplied),
            source,
            seconds,
          })
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "AI search failed."
        scenes.push({
          ...sceneFromBlock(block, [], true, true),
          filled: false,
          clips: [],
          reason: `${detail} Nothing was guessed.`,
        })
        continue
      }
    }

    if (useTitles || byItem.size > 0) {
      const ranked = rankedItems(block.query, pool, labelTags)
      for (const row of ranked) {
        const item = pool.find((entry) => entry.id === row.item.id)
        if (!item) {
          continue
        }
        const mine = byItem.get(item.id) ?? []
        if (mine.length > 0) {
          for (const segment of mine) {
            push(keywordClip(item, segment, block.durationSeconds))
          }
          continue
        }
        if (useTitles) {
          push(keywordClip(item, null, block.durationSeconds))
        }
      }
    }

    candidates.sort((a, b) => Number(b.source === "approved") - Number(a.source === "approved"))
    const scene = sceneFromBlock(block, candidates, connected, Boolean(indexId))
    if (block.folderName && scene.clips.length === 0) {
      scene.reason = `Nothing in the folder “${block.folderName}” matched closely enough. Nothing outside that folder was used.`
    }
    for (const clip of scene.clips) {
      used.add(clipKey(clip.mediaId, clip.start))
    }
    scenes.push(scene)
  }

  return {
    connected,
    mode,
    note,
    scenes,
  }
}
