import "server-only"

import type { SearchHit } from "@/lib/moment-pick"

const API = "https://api.twelvelabs.io/v1.3"

export class TwelveLabsError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "TwelveLabsError"
    this.status = status
  }
}

export function isTwelveLabsConfigured() {
  return Boolean(process.env.TWELVE_LABS_API_KEY?.trim())
}

function apiKey() {
  const key = process.env.TWELVE_LABS_API_KEY?.trim() ?? ""
  if (!key) {
    throw new TwelveLabsError("AI search not connected yet", 0)
  }
  return key
}

function scrub(message: string) {
  const key = process.env.TWELVE_LABS_API_KEY?.trim()
  if (key && message.includes(key)) {
    return message.split(key).join("the API key")
  }
  return message
}

function plainMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    const message = record.message ?? record.error
    if (typeof message === "string" && message.trim()) {
      return scrub(message.trim().slice(0, 300))
    }
  }
  return `Twelve Labs returned an error (${status}).`
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("x-api-key", apiKey())
  const response = await fetch(`${API}${path}`, { ...init, headers })
  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text.slice(0, 300) }
    }
  }
  if (!response.ok) {
    throw new TwelveLabsError(plainMessage(body, response.status), response.status)
  }
  return body
}

function idOf(value: unknown) {
  if (!value || typeof value !== "object") {
    return ""
  }
  const record = value as Record<string, unknown>
  const id = record._id ?? record.id
  return typeof id === "string" ? id : ""
}

function statusOf(value: unknown) {
  if (!value || typeof value !== "object") {
    return ""
  }
  const status = (value as Record<string, unknown>).status
  return typeof status === "string" ? status.toLowerCase() : ""
}

export function indexNameForProject(projectId: string) {
  return `retreat_${projectId}`
}

export async function findIndexByName(name: string) {
  const body = (await request("/indexes?page_limit=50")) as { data?: unknown }
  const rows = Array.isArray(body?.data) ? body.data : []
  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue
    }
    const record = row as Record<string, unknown>
    if (record.index_name === name) {
      const id = idOf(record)
      if (id) {
        return id
      }
    }
  }
  return null
}

export async function createTwelveLabsIndex(name: string) {
  const body = await request("/indexes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index_name: name,
      models: [
        {
          model_name: "marengo3.0",
          model_options: ["visual", "audio"],
        },
      ],
    }),
  })
  const id = idOf(body)
  if (!id) {
    throw new TwelveLabsError("Twelve Labs did not return an index id.", 502)
  }
  return id
}

export async function createAssetFromUrl(url: string) {
  const form = new FormData()
  form.append("method", "url")
  form.append("url", url)
  const body = await request("/assets", { method: "POST", body: form })
  const id = idOf(body)
  if (!id) {
    throw new TwelveLabsError("Twelve Labs did not accept the video.", 502)
  }
  return { id, status: statusOf(body) }
}

export async function retrieveAsset(assetId: string) {
  const body = await request(`/assets/${encodeURIComponent(assetId)}`)
  return { id: idOf(body) || assetId, status: statusOf(body) }
}

export async function createIndexedAsset(
  indexId: string,
  assetId: string,
  mediaItemId: string,
) {
  const body = await request(
    `/indexes/${encodeURIComponent(indexId)}/indexed-assets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_id: assetId,
        user_metadata: { media_item_id: mediaItemId },
      }),
    },
  )
  const id = idOf(body)
  if (!id) {
    throw new TwelveLabsError("Twelve Labs did not start indexing.", 502)
  }
  return { id, status: statusOf(body) }
}

export async function retrieveIndexedAsset(indexId: string, indexedId: string) {
  const body = await request(
    `/indexes/${encodeURIComponent(indexId)}/indexed-assets/${encodeURIComponent(indexedId)}`,
  )
  let videoId = ""
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>
    if (typeof record.video_id === "string") {
      videoId = record.video_id
    }
  }
  return {
    id: idOf(body) || indexedId,
    videoId,
    status: statusOf(body),
  }
}

function numberOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function hitsFrom(value: unknown): SearchHit[] {
  if (!value || typeof value !== "object") {
    return []
  }
  const data = (value as Record<string, unknown>).data
  if (!Array.isArray(data)) {
    return []
  }
  const hits: SearchHit[] = []
  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue
    }
    const record = item as Record<string, unknown>
    const start = numberOf(record.start)
    const end = numberOf(record.end)
    const videoId = typeof record.video_id === "string" ? record.video_id : ""
    if (start == null || end == null || !videoId) {
      continue
    }
    const metadata = record.user_metadata
    let mediaItemId: string | null = null
    if (metadata && typeof metadata === "object") {
      const raw = (metadata as Record<string, unknown>).media_item_id
      if (typeof raw === "string") {
        mediaItemId = raw
      }
    }
    hits.push({
      videoId,
      start,
      end,
      rank: numberOf(record.rank),
      confidence: typeof record.confidence === "string" ? record.confidence : null,
      score: numberOf(record.score),
      mediaItemId,
    })
  }
  return hits
}

async function searchOnce(indexId: string, query: string, withThreshold: boolean) {
  const form = new FormData()
  form.append("query_text", query)
  form.append("index_id", indexId)
  form.append("search_options", "visual")
  form.append("search_options", "audio")
  form.append("group_by", "clip")
  form.append("operator", "or")
  form.append("page_limit", "8")
  form.append("include_user_metadata", "true")
  if (withThreshold) {
    form.append("threshold", "high")
    form.append("sort_option", "score")
  }
  return request("/search", { method: "POST", body: form })
}

export async function searchIndex(indexId: string, queryText: string) {
  const query = queryText.trim().slice(0, 400)
  if (!query) {
    return { hits: [] as SearchHit[], thresholdApplied: true }
  }
  try {
    const body = await searchOnce(indexId, query, true)
    return { hits: hitsFrom(body), thresholdApplied: true }
  } catch (error) {
    if (error instanceof TwelveLabsError && error.status === 400) {
      const body = await searchOnce(indexId, query, false)
      return { hits: hitsFrom(body), thresholdApplied: false }
    }
    throw error
  }
}

export async function deleteTwelveLabsIndex(indexId: string) {
  await request(`/indexes/${encodeURIComponent(indexId)}`, { method: "DELETE" })
}

export async function deleteTwelveLabsAsset(assetId: string) {
  await request(`/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" })
}
