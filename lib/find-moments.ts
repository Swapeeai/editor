// Title and file-name matching.
// Create Video uses this when the Twelve Labs key is missing, or when no
// video in the project is ready to search yet. It does not watch the footage.

import type { SampleMedia } from "@/lib/sample-media"

export type MomentMatch = {
  phrase: string
  media: SampleMedia | null
  reason: string
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "then",
  "over",
  "with",
  "someone",
  "some",
  "of",
  "to",
  "on",
  "in",
  "for",
  "from",
  "at",
  "by",
  "into",
  "our",
  "my",
  "her",
  "his",
  "their",
  "this",
  "that",
  "it",
  "is",
  "be",
  "announce",
  "camp",
  "date",
  "place",
  "background",
])

// "then" starts a new scene. Commas stay inside a scene.
export function splitDirection(direction: string) {
  return direction
    .split(/\bthen\b/i)
    .map((part) => part.replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "").trim())
    .filter((part) => part.length > 0)
}

function meaningfulWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

// One shared word is not enough. A keyword she typed, or two title words, is.
export const MATCH_THRESHOLD = 4

function includesWord(haystack: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const plural = word.length > 3 ? `(?:${escaped}|${escaped}s|${escaped}es)` : escaped
  return new RegExp(`\\b${plural}\\b`, "i").test(haystack)
}

function scoreItem(phrase: string, item: SampleMedia) {
  const phraseText = phrase.toLowerCase()
  let points = 0
  const reasons: string[] = []

  for (const tag of item.tags) {
    const keyword = tag.trim().toLowerCase()
    if (keyword.length < 3) {
      continue
    }
    const hit = keyword.includes(" ")
      ? phraseText.includes(keyword)
      : includesWord(phraseText, keyword)
    if (hit) {
      points += 6
      reasons.push(`the keyword “${tag.trim()}”`)
    }
  }

  const phraseWords = new Set(meaningfulWords(phrase))
  const titleHits = meaningfulWords(item.title).filter((word) => phraseWords.has(word))
  if (titleHits.length > 0) {
    points += titleHits.length * 2
    if (reasons.length === 0) {
      reasons.push("words in the title")
    }
  } else if (item.fileName) {
    const stem = item.fileName.replace(/\.[a-z0-9]+$/i, "")
    const nameHits = meaningfulWords(stem).filter((word) => phraseWords.has(word))
    if (nameHits.length > 0) {
      points += nameHits.length * 2
      if (reasons.length === 0) {
        reasons.push("words in the file name")
      }
    }
  }

  return { points, reasons }
}

export function rankPhrase(phrase: string, library: SampleMedia[]) {
  return library
    .map((item) => {
      const result = scoreItem(phrase, item)
      return { item, points: result.points, reasons: result.reasons }
    })
    .filter((row) => row.points >= MATCH_THRESHOLD)
    .sort((a, b) => b.points - a.points)
}

export function findMoments(
  direction: string,
  library: SampleMedia[],
): MomentMatch[] {
  const used = new Set<string>()

  return splitDirection(direction).map((phrase) => {
    const ranked = rankPhrase(phrase, library).filter((row) => !used.has(row.item.id))
    const best = ranked[0] ?? null

    if (!best) {
      return {
        phrase,
        media: null,
        reason:
          "No title or keyword matched these words closely enough. Nothing was guessed.",
      }
    }

    used.add(best.item.id)
    const uniqueReasons = [...new Set(best.reasons)]
    return {
      phrase,
      media: best.item,
      reason: `Matched ${uniqueReasons.join(", ")}.`,
    }
  })
}
