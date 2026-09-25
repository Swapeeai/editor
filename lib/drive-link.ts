// Turns a pasted Google Drive share link into a file id.
// Folders are refused. The id is fetched later with the sign-in token.

const FILE_ID = "[A-Za-z0-9_-]{10,}"

export type ParsedDriveLine =
  | { kind: "empty" }
  | { kind: "file"; id: string }
  | { kind: "bad"; message: string }

export function parseDriveLine(raw: string): ParsedDriveLine {
  const line = raw.trim()
  if (!line) {
    return { kind: "empty" }
  }
  if (/google\.com\/[^\s]*\/folders\//i.test(line)) {
    return {
      kind: "bad",
      message: "That link is a folder. Paste a link to one video or photo.",
    }
  }
  const patterns = [
    new RegExp(`/file/d/(${FILE_ID})`, "i"),
    new RegExp(`[?&]id=(${FILE_ID})`, "i"),
    new RegExp(`/d/(${FILE_ID})`, "i"),
  ]
  for (const pattern of patterns) {
    const match = line.match(pattern)
    if (match?.[1]) {
      return { kind: "file", id: match[1] }
    }
  }
  if (new RegExp(`^${FILE_ID}$`).test(line)) {
    return { kind: "file", id: line }
  }
  return {
    kind: "bad",
    message: "That does not look like a Google Drive file link.",
  }
}

export function parseDriveLinks(text: string) {
  const files: { id: string }[] = []
  const problems: string[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const parsed = parseDriveLine(raw)
    if (parsed.kind === "empty") {
      continue
    }
    if (parsed.kind === "bad") {
      problems.push(parsed.message)
      continue
    }
    if (seen.has(parsed.id)) {
      continue
    }
    seen.add(parsed.id)
    files.push({ id: parsed.id })
  }
  return { files, problems }
}
