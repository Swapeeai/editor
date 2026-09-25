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
const MAX_CONCURRENT_INDEX = 4
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
      const signed = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(item.storagePath, SIGNED_URL_SECONDS)
      if (signed.error || !signed.data?.signedUrl) {
        throw new TwelveLabsError("Could not open this video for indexing.", 502)
      }
      const created = await createAssetFromUrl(signed.data.signedUrl)
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

async function idsFor(projectId: ProjectId, mode: "sync" | "prepare") {
  const { listProjectItems } = await import("@/lib/media-db")
  const listed = await listProjectItems(projectId)
  if (!listed.indexSchema) {
    throw new IndexSchemaError()
  }
  const ids = listed.items
    .filter((item) => shouldIndex(item.storagePath, item.mediaType))
    .filter((item) => {
      if (item.indexStatus === "ready") {
        return false
      }
      if (mode === "sync") {
        return item.indexStatus === "pending" || item.indexStatus === "indexing"
      }
      return true
    })
    .slice(0, BATCH)
    .map((item) => item.id)
  return ids
}

export async function syncProject(projectId: ProjectId) {
  if (!isTwelveLabsConfigured()) {
    return { ok: false as const, message: "AI search not connected yet" }
  }
  const ids = await idsFor(projectId, "sync")
  const results = []
  for (const id of ids) {
    results.push(await advanceMedia(id))
  }
  return { ok: true as const, updated: results.length, results }
}

export async function prepareProject(projectId: ProjectId) {
  if (!isTwelveLabsConfigured()) {
    return { ok: false as const, message: "AI search not connected yet" }
  }
  const { listProjectItems } = await import("@/lib/media-db")
  const listed = await listProjectItems(projectId)
  if (!listed.indexSchema) {
    throw new IndexSchemaError()
  }
  const targets = listed.items.filter(
    (item) =>
      shouldIndex(item.storagePath, item.mediaType) && item.indexStatus !== "ready",
  )
  for (const item of targets) {
    if (item.indexStatus !== "pending" && item.indexStatus !== "indexing") {
      await saveIndexFields(item.id, { index_status: "pending", index_error: null })
    }
  }
  const ids = targets.slice(0, BATCH).map((item) => item.id)
  for (const id of ids) {
    await advanceMedia(id)
  }
  const waiting = Math.max(0, targets.length - ids.length)
  return {
    ok: true as const,
    started: ids.length,
    waiting,
    message:
      ids.length === 0
        ? "Every video in this project is already ready for AI search."
        : waiting > 0
          ? `Started ${ids.length} videos. ${waiting} more will start as those finish.`
          : `Started indexing ${ids.length} ${ids.length === 1 ? "video" : "videos"}.`,
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
