// Picks a search hit only when it clears the confidence bar.
// Twelve Labs documents rank on every hit. Confidence and score appear
// when the API sends them. threshold=high is sent when the API accepts it.

export type SearchHit = {
  videoId: string
  start: number
  end: number
  rank: number | null
  confidence: string | null
  score: number | null
  mediaItemId: string | null
}

export function hitIsStrong(hit: SearchHit, thresholdApplied: boolean) {
  if (!(hit.end > hit.start) || !hit.videoId) {
    return false
  }
  const confidence = (hit.confidence ?? "").toLowerCase()
  if (confidence === "low" || confidence === "medium") {
    return false
  }
  if (confidence === "high") {
    return true
  }
  if (typeof hit.score === "number" && Number.isFinite(hit.score)) {
    if (hit.score <= 1) {
      return hit.score >= 0.75
    }
    return hit.score >= 75
  }
  if (thresholdApplied) {
    return true
  }
  return hit.rank === 1
}

export function bestHit(
  hits: SearchHit[],
  thresholdApplied: boolean,
  used: Set<string>,
) {
  const ranked = hits
    .filter((hit) => hitIsStrong(hit, thresholdApplied))
    .slice()
    .sort((a, b) => {
      const rankA = a.rank ?? 999
      const rankB = b.rank ?? 999
      if (rankA !== rankB) {
        return rankA - rankB
      }
      return (b.score ?? 0) - (a.score ?? 0)
    })

  for (const hit of ranked) {
    const key = `${hit.mediaItemId || hit.videoId}:${hit.start.toFixed(2)}`
    if (used.has(key)) {
      continue
    }
    return hit
  }
  return null
}

export function confidenceLabel(hit: SearchHit, thresholdApplied: boolean) {
  const confidence = (hit.confidence ?? "").toLowerCase()
  if (confidence === "high" || confidence === "medium" || confidence === "low") {
    return confidence
  }
  if (typeof hit.score === "number" && Number.isFinite(hit.score)) {
    const shown = hit.score <= 1 ? Math.round(hit.score * 100) : Math.round(hit.score)
    return String(shown)
  }
  if (thresholdApplied) {
    return "high"
  }
  if (hit.rank != null) {
    return `rank ${hit.rank}`
  }
  return "high"
}
