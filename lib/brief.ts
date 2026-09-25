// Turns a direction into scenes.
// Timed headers such as "0–3 sec — Paradise" become one scene each.
// "then" and one-line-per-scene still work when there is no timecode.

export type BriefBlock = {
  kind: "scene" | "note"
  label: string | null
  query: string
  caption: string | null
  startSeconds: number | null
  endSeconds: number | null
  durationSeconds: number | null
  folderName: string | null
}

const NOTE_HEADING =
  /^(style|notes?|music|audio|soundtrack|sound|closing|end(?:\s+card)?|overall|tone|mood|do not|don't|direction notes?)\b/i

function stripMarkup(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*]\s+/, "")
    .trim()
}

function cleanLabel(value: string | undefined) {
  const label = (value ?? "").replace(/^[-–—:\s]+|[-–—:\s]+$/g, "").trim()
  return label || null
}

function clockToSeconds(value: string) {
  const parts = value.split(":").map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part))) {
    return null
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return null
}

type Header =
  | { kind: "time"; start: number; end: number | null; label: string | null }
  | { kind: "note"; label: string }

function parseHeader(line: string): Header | null {
  const text = stripMarkup(line)
  if (!text || text.length > 120) {
    return null
  }

  const seconds = text.match(
    /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(?:seconds|secs|sec|s)\b(?:\s*[-–—:]\s*(.+))?$/i,
  )
  if (seconds) {
    const start = Number(seconds[1])
    const end = Number(seconds[2])
    if (end > start) {
      return { kind: "time", start, end, label: cleanLabel(seconds[3]) }
    }
  }

  const clock = text.match(
    /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\b(?:\s*[-–—:]\s*(.+))?$/,
  )
  if (clock) {
    const start = clockToSeconds(clock[1])
    const end = clockToSeconds(clock[2])
    if (start != null && end != null && end > start) {
      return { kind: "time", start, end, label: cleanLabel(clock[3]) }
    }
  }

  const single = text.match(
    /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)\b(?:\s*[-–—:]\s*(.+))?$/,
  )
  if (single) {
    const start = clockToSeconds(single[1])
    if (start != null) {
      return { kind: "time", start, end: null, label: cleanLabel(single[2]) }
    }
  }

  if (NOTE_HEADING.test(text)) {
    return { kind: "note", label: text }
  }
  return null
}

function folderFrom(line: string) {
  const text = stripMarkup(line)
  const match = text.match(/^folder\s*:\s*(.+)$/i)
  if (!match) {
    return null
  }
  return match[1].trim().slice(0, 80) || null
}

function captionFrom(line: string) {
  const text = stripMarkup(line)
  const match = text.match(/^text\s*:\s*(.*)$/i)
  if (!match) {
    return null
  }
  return match[1].trim()
}

function blockFrom(
  header: Header,
  bodyLines: string[],
  nextStart: number | null,
): BriefBlock {
  const captions = bodyLines
    .map(captionFrom)
    .filter((line): line is string => Boolean(line))
  const folderName = bodyLines.map(folderFrom).find((name) => name) ?? null
  const query = bodyLines
    .filter((line) => captionFrom(line) == null && folderFrom(line) == null)
    .map(stripMarkup)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  if (header.kind === "note") {
    return {
      kind: "note",
      label: header.label,
      query: query || header.label,
      caption: captions.length > 0 ? captions.join("\n") : null,
      startSeconds: null,
      endSeconds: null,
      durationSeconds: null,
      folderName: null,
    }
  }

  let end = header.end
  if (end == null && nextStart != null && nextStart > header.start) {
    end = nextStart
  }
  const duration = end != null && end > header.start ? end - header.start : null
  return {
    kind: "scene",
    label: header.label,
    query: query || header.label || "",
    caption: captions.length > 0 ? captions.join("\n") : null,
    startSeconds: header.start,
    endSeconds: end,
    durationSeconds: duration,
    folderName,
  }
}

function parseTimed(lines: string[]): BriefBlock[] {
  const headers: { index: number; header: Header }[] = []
  lines.forEach((line, index) => {
    const header = parseHeader(line)
    if (header) {
      headers.push({ index, header })
    }
  })

  const blocks: BriefBlock[] = []
  headers.forEach((entry, position) => {
    const next = headers[position + 1]
    const body = lines.slice(entry.index + 1, next ? next.index : lines.length)
    const nextStart =
      next?.header.kind === "time" ? next.header.start : null
    blocks.push(blockFrom(entry.header, body, nextStart))
  })
  return blocks.filter((block) => block.kind === "note" || block.query || block.label)
}

function parseLoose(text: string): BriefBlock[] {
  if (/\bthen\b/i.test(text)) {
    return text
      .split(/\bthen\b/i)
      .map((part) => stripMarkup(part).replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "").trim())
      .filter(Boolean)
      .map((query) => ({
        kind: "scene" as const,
        label: null,
        query,
        caption: null,
        startSeconds: null,
        endSeconds: null,
        durationSeconds: null,
        folderName: null,
      }))
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length <= 1) {
    const query = stripMarkup(lines[0] ?? text)
    if (!query) {
      return []
    }
    return [
      {
        kind: "scene",
        label: null,
        query,
        caption: null,
        startSeconds: null,
        endSeconds: null,
        durationSeconds: null,
        folderName: null,
      },
    ]
  }

  const blocks: BriefBlock[] = []
  for (const line of lines) {
    const header = parseHeader(line)
    if (header?.kind === "note") {
      blocks.push({
        kind: "note",
        label: header.label,
        query: header.label,
        caption: null,
        startSeconds: null,
        endSeconds: null,
        durationSeconds: null,
        folderName: null,
      })
      continue
    }
    const folderName = folderFrom(line)
    if (folderName && blocks.length > 0 && blocks[blocks.length - 1].kind === "scene") {
      blocks[blocks.length - 1].folderName = folderName
      continue
    }
    const caption = captionFrom(line)
    if (caption && blocks.length > 0 && blocks[blocks.length - 1].kind === "scene") {
      const previous = blocks[blocks.length - 1]
      previous.caption = previous.caption ? `${previous.caption}\n${caption}` : caption
      continue
    }
    const query = stripMarkup(line)
    if (!query) {
      continue
    }
    blocks.push({
      kind: "scene",
      label: null,
      query,
      caption: null,
      startSeconds: null,
      endSeconds: null,
      durationSeconds: null,
      folderName: null,
    })
  }
  return blocks
}

export function parseBrief(direction: string): BriefBlock[] {
  const lines = direction.split(/\r?\n/)
  const timed = lines.some((line) => parseHeader(line)?.kind === "time")
  if (timed) {
    return parseTimed(lines)
  }
  return parseLoose(direction)
}
