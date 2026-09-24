// Placeholder for Twelve Labs.
//
// findMoments is the only function that picks a photo or video
// for each line of a direction. It matches words to titles, tags, places,
// and file names. It does not watch the footage, and it does not call any AI.
//
// When there is a Twelve Labs account, replace the body of findMoments
// with that call. Keep the MomentMatch shape so the Create Video page
// can stay as it is.

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

function scoreItem(phrase: string, item: SampleMedia) {
  const phraseText = phrase.toLowerCase()
  let points = 0
  const reasons: string[] = []

  for (const tag of item.tags) {
    // "instructors" still matches the tag "instructor".
    if (phraseText.includes(tag.toLowerCase())) {
      points += 5
      reasons.push(`the tag “${tag}”`)
    }
  }

  const place = item.location.split(",")[0]?.trim().toLowerCase() ?? ""
  if (place.length > 2 && phraseText.includes(place)) {
    points += 4
    reasons.push(`the place “${item.location}”`)
  }

  if (
    phraseText.includes("background") &&
    item.tags.some((tag) => tag === "beach" || tag === "sunset" || tag === "studio")
  ) {
    points += 3
    reasons.push("a beach, sunset, or studio tag for the background")
  }

  const phraseWords = new Set(meaningfulWords(phrase))
  const titleHits = meaningfulWords(item.title).filter((word) => phraseWords.has(word))
  if (titleHits.length > 0) {
    points += titleHits.length * 2
    // Tags and places are easier to read than a list of title words.
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

export function findMoments(
  direction: string,
  library: SampleMedia[],
): MomentMatch[] {
  const used = new Set<string>()

  return splitDirection(direction).map((phrase) => {
    let best: { item: SampleMedia; points: number; reasons: string[] } | null =
      null

    for (const item of library) {
      if (used.has(item.id)) {
        continue
      }
      const result = scoreItem(phrase, item)
      if (result.points === 0) {
        continue
      }
      if (!best || result.points > best.points) {
        best = { item, points: result.points, reasons: result.reasons }
      }
    }

    if (!best) {
      return {
        phrase,
        media: null,
        reason: "No title, tag, place, or file name matched these words.",
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
