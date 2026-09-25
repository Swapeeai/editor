import "server-only"

import { IndexSchemaError, isMissingIndexSchema, readLibraryItem } from "@/lib/media-db"
import type { ProjectId } from "@/lib/projects"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import {
  createAssetFromUrl,
  createIndexedAsset,
  createTwelveLabsIndex,
  findIndexByName,
  indexNameForProject,
  isTwelveLabsConfigured,
  retrieveAsset,
  retrieveIndexedAsset,
  TwelveLabsError,
} from "@/lib/twelvelabs"

const advancing = new Map<string, Promise<AdvanceResult>>()
const MAX_CONCURRENT_INDEX = 5
export const FREE_INDEX_MINUTES = 600
const FREE_INDEX_SECONDS = FREE_INDEX_MINUTES * 60
let indexActive = 0
const indexWaiters: Array<() => void> = []

async function withIndexSlot<T>(work: () => Promise<T>) {
  if (indexActive >= MAX_CONCURRENT_INDEX) {
    await new Promise<void>((resolve) => {
      indexWaiters.push(resolve)
    })
  }
  indexActive += 1
  try {
    return await work()
  } finally {
    indexActive -= 1
    indexWaiters.shift()?.()
  }
}

export type AdvanceResult = "skipped" | "advanced" | "ready" | "failed" | "schema"

const SIGNED_URL_SECONDS = 60 * 60 * 6
const BATCH = 5

function shouldIndex(storagePath: string, mediaType: string) {
  return mediaType === "video" && !storagePath.includes("/exports/")
}

async function saveIndexFields(
  id: string,
  fields: {
    twelvelabs_video_id?: string | null
    twelvelabs_asset_id?: string | null
    index_status?: string | null
    index_error?: string | null
  },
) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return false
  }
  const updated = await supabase.from("media_items").update(fields).eq("id", id)
  if (updated.error) {
    if (isMissingIndexSchema(updated.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not save the indexing status.")
  }
  return true
}

export async function ensureProjectIndex(projectId: ProjectId) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    throw new Error("Supabase is not connected.")
  }

  const existing = await supabase
    .from("twelvelabs_indexes")
    .select("index_id")
    .eq("project_id", projectId)
    .maybeSingle()

  if (existing.error) {
    if (isMissingIndexSchema(existing.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not read the Twelve Labs index for this project.")
  }

  const savedId = existing.data?.index_id
  if (typeof savedId === "string" && savedId) {
    return savedId
  }

  const name = indexNameForProject(projectId)
  let indexId = await findIndexByName(name)
  if (!indexId) {
    try {
      indexId = await createTwelveLabsIndex(name)
    } catch (error) {
      indexId = await findIndexByName(name)
      if (!indexId) {
        throw error
      }
    }
  }

  const saved = await supabase
    .from("twelvelabs_indexes")
    .upsert({ project_id: projectId, index_id: indexId })

  if (saved.error) {
    if (isMissingIndexSchema(saved.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not save the Twelve Labs index id.")
  }

  return indexId
}

async function advanceBody(id: string): Promise<AdvanceResult> {
  if (!isTwelveLabsConfigured()) {
    return "skipped"
  }
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return "skipped"
  }

  let item
  try {
    item = await readLibraryItem(id)
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return "schema"
    }
    throw error
  }
  if (!item || !shouldIndex(item.storagePath, item.mediaType)) {
    return "skipped"
  }
  if (item.indexStatus === "ready" && item.twelveLabsVideoId) {
    return "ready"
  }

  try {
    const indexId = await ensureProjectIndex(item.projectId)
    let assetId = item.twelveLabsAssetId
    let videoId = item.twelveLabsVideoId

    if (!assetId) {
      const seconds = item.durationSeconds
      if (seconds == null || !(seconds > 0)) {
        await saveIndexFields(id, {
          index_status: "failed",
          index_error: "This video has no length yet, so it was not sent.",
        })
        return "failed"
      }
      const signed = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(item.storagePath, SIGNED_URL_SECONDS)
      if (signed.error || !signed.data?.signedUrl) {
        throw new TwelveLabsError("Could not open this video for indexing.", 502)
      }
      const created = await createAssetFromUrl(signed.data.signedUrl)
      await recordIndexUse(item.projectId, id, seconds)
      assetId = created.id
      await saveIndexFields(id, {
        twelvelabs_asset_id: assetId,
        index_status: "indexing",
        index_error: null,
      })
      if (created.status && created.status !== "ready") {
        return "advanced"
      }
    }

    const asset = await retrieveAsset(assetId)
    if (asset.status === "failed" || asset.status === "error") {
      await saveIndexFields(id, {
        twelvelabs_asset_id: null,
        twelvelabs_video_id: null,
        index_status: "failed",
        index_error: "Twelve Labs could not read this video. Use Retry.",
      })
      return "failed"
    }
    if (asset.status !== "ready") {
      await saveIndexFields(id, { index_status: "indexing", index_error: null })
      return "advanced"
    }

    if (!videoId) {
      const indexed = await createIndexedAsset(indexId, assetId, id)
      videoId = indexed.id
      await saveIndexFields(id, {
        twelvelabs_video_id: videoId,
        index_status: "indexing",
        index_error: null,
      })
      if (indexed.status !== "ready") {
        return "advanced"
      }
    }

    const indexed = await retrieveIndexedAsset(indexId, videoId)
    if (indexed.status === "failed" || indexed.status === "error") {
      await saveIndexFields(id, {
        twelvelabs_video_id: null,
        index_status: "failed",
        index_error: "Twelve Labs could not finish indexing this video. Use Retry.",
      })
      return "failed"
    }
    if (indexed.status !== "ready") {
      await saveIndexFields(id, { index_status: "indexing", index_error: null })
      return "advanced"
    }

    const resolvedVideoId = indexed.videoId || indexed.id || videoId
    await saveIndexFields(id, {
      twelvelabs_video_id: resolvedVideoId,
      index_status: "ready",
      index_error: null,
    })
    return "ready"
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return "schema"
    }
    const message =
      error instanceof Error ? error.message : "Could not index this video."
    try {
      await saveIndexFields(id, { index_status: "failed", index_error: message })
    } catch (saveError) {
      if (saveError instanceof IndexSchemaError) {
        return "schema"
      }
    }
    return "failed"
  }
}

export function advanceMedia(id: string) {
  const existing = advancing.get(id)
  if (existing) {
    return existing
  }
  const run = withIndexSlot(() => advanceBody(id)).finally(() => {
    advancing.delete(id)
  })
  advancing.set(id, run)
  return run
}

async function recordIndexUse(projectId: ProjectId, mediaId: string, seconds: number) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return
  }
  const inserted = await supabase.from("index_usage").insert({
    media_item_id: mediaId,
    project_id: projectId,
    duration_seconds: seconds,
  })
  if (inserted.error && !/index_usage|schema cache|could not find/i.test(inserted.error.message)) {
    throw new Error("Could not record the indexing minutes.")
  }
}

async function idsFor(projectId: ProjectId, mode: "sync" | "poll") {
  const { listProjectItems } = await import("@/lib/media-db")
  const listed = await listProjectItems(projectId)
  if (!listed.indexSchema) {
    throw new IndexSchemaError()
  }
  const videos = listed.items.filter((item) =>
    shouldIndex(item.storagePath, item.mediaType),
  )
  const indexing = videos.filter((item) => item.indexStatus === "indexing")
  if (mode === "poll") {
    return indexing.slice(0, BATCH).map((item) => item.id)
  }
  const chosen = indexing.slice(0, BATCH)
  for (const item of videos) {
    if (chosen.length >= BATCH) {
      break
    }
    if (item.indexStatus === "pending" && !chosen.some((entry) => entry.id === item.id)) {
      chosen.push(item)
    }
  }
  return chosen.map((item) => item.id)
}

export async function syncProject(projectId: ProjectId, mode: "sync" | "poll" = "sync") {
  if (!isTwelveLabsConfigured()) {
    return { ok: false as const, message: "AI search not connected yet" }
  }
  const ids = await idsFor(projectId, mode)
  const results = []
  for (const id of ids) {
    results.push(await advanceMedia(id))
  }
  return { ok: true as const, updated: results.length, results }
}

export async function estimateIndexUse() {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return {
      ok: false as const,
      usedSeconds: 0,
      limitSeconds: FREE_INDEX_SECONDS,
      usageReady: false,
      message: "Supabase is not connected.",
    }
  }

  const usage = await supabase.from("index_usage").select("duration_seconds")
  let logged = 0
  let usageReady = true
  if (usage.error) {
    usageReady = false
  } else {
    for (const row of usage.data ?? []) {
      const seconds = Number((row as { duration_seconds?: unknown }).duration_seconds)
      if (Number.isFinite(seconds) && seconds > 0) {
        logged += seconds
      }
    }
  }

  const videos = await supabase
    .from("media_items")
    .select("duration_seconds, index_status, media_type")
    .in("index_status", ["ready", "indexing"])
  let measured = 0
  if (!videos.error) {
    for (const row of videos.data ?? []) {
      const record = row as {
        duration_seconds?: unknown
        media_type?: unknown
      }
      if (record.media_type !== "video") {
        continue
      }
      const seconds = Number(record.duration_seconds)
      if (Number.isFinite(seconds) && seconds > 0) {
        measured += seconds
      }
    }
  }

  return {
    ok: true as const,
    usedSeconds: Math.max(logged, measured),
    limitSeconds: FREE_INDEX_SECONDS,
    usageReady,
    message: usageReady
      ? null
      : "Run supabase/schema-update.sql so the minute total is kept. This figure is an estimate from videos already sent.",
  }
}

export async function prepareSelected(projectId: ProjectId, mediaIds: string[]) {
  if (!isTwelveLabsConfigured()) {
    return { ok: false as const, message: "AI search not connected yet" }
  }
  const { listProjectItems } = await import("@/lib/media-db")
  const listed = await listProjectItems(projectId)
  if (!listed.indexSchema) {
    throw new IndexSchemaError()
  }
  const wanted = new Set(mediaIds)
  const targets = listed.items.filter(
    (item) =>
      wanted.has(item.id) &&
      shouldIndex(item.storagePath, item.mediaType) &&
      item.indexStatus !== "ready",
  )
  if (targets.length === 0) {
    return {
      ok: false as const,
      message: "Select a video that is not already ready for AI search.",
    }
  }
  const missingLength = targets.filter((item) => !(item.durationSeconds && item.durationSeconds > 0))
  if (missingLength.length > 0) {
    return {
      ok: false as const,
      message: `${missingLength.length} selected ${missingLength.length === 1 ? "video has" : "videos have"} no length yet, so nothing was sent.`,
    }
  }
  const selectedSeconds = targets.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0)
  const quota = await estimateIndexUse()
  if (quota.ok && quota.usedSeconds + selectedSeconds > quota.limitSeconds + 1) {
    const selectedMinutes = Math.ceil(selectedSeconds / 60)
    const usedMinutes = Math.ceil(quota.usedSeconds / 60)
    return {
      ok: false as const,
      message: `That selection is about ${selectedMinutes} minutes, and about ${usedMinutes} of ${FREE_INDEX_MINUTES} are already used. Nothing was sent.`,
    }
  }
  for (const item of targets) {
    if (item.indexStatus !== "pending" && item.indexStatus !== "indexing") {
      await saveIndexFields(item.id, { index_status: "pending", index_error: null })
    }
  }
  const ids = await idsFor(projectId, "sync")
  for (const id of ids) {
    await advanceMedia(id)
  }
  const waiting = Math.max(0, targets.length - ids.length)
  return {
    ok: true as const,
    started: Math.min(ids.length, targets.length),
    waiting,
    selected: targets.length,
    message:
      waiting > 0
        ? `Started ${Math.min(BATCH, targets.length)} videos. ${waiting} more stay waiting until you continue or those finish.`
        : `Started indexing ${targets.length} ${targets.length === 1 ? "video" : "videos"}.`,
  }
}

export async function stopPending(projectId: ProjectId) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, message: "Supabase is not connected." }
  }
  const updated = await supabase
    .from("media_items")
    .update({ index_status: null, index_error: null })
    .eq("project_id", projectId)
    .eq("index_status", "pending")
    .select("id")
  if (updated.error) {
    if (isMissingIndexSchema(updated.error.message)) {
      throw new IndexSchemaError()
    }
    throw new Error("Could not stop the waiting videos.")
  }
  const stopped = updated.data?.length ?? 0
  return {
    ok: true as const,
    stopped,
    message:
      stopped === 0
        ? "No videos were waiting. Any video already sent will finish."
        : `Stopped ${stopped} waiting ${stopped === 1 ? "video" : "videos"}. Any video already sent will finish.`,
  }
}

export async function retryMedia(id: string) {
  if (!isTwelveLabsConfigured()) {
    return { ok: false as const, message: "AI search not connected yet" }
  }
  await saveIndexFields(id, {
    index_status: "pending",
    index_error: null,
    twelvelabs_video_id: null,
    twelvelabs_asset_id: null,
  })
  const result = await advanceMedia(id)
  return { ok: true as const, result }
}

export async function markUploadedVideo(id: string, storagePath: string, mediaType: string) {
  if (!isTwelveLabsConfigured() || !shouldIndex(storagePath, mediaType)) {
    return false
  }
  try {
    await saveIndexFields(id, { index_status: "pending", index_error: null })
    return true
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return false
    }
    return false
  }
}
