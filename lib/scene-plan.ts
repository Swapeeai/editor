// Packs matched clips into the time a brief section asked for.

export type StoryClip = {
  mediaId: string
  title: string
  photo: boolean
  start: number
  end: number | null
  confidence: string | null
  source: "twelvelabs" | "titles" | "approved"
  seconds: number
}

export type PlannedScene = {
  kind: "scene" | "note"
  label: string | null
  phrase: string
  caption: string | null
  durationSeconds: number | null
  startSeconds: number | null
  endSeconds: number | null
  folderName: string | null
  clips: StoryClip[]
  filled: boolean
  reason: string
}

export function packClips(durationSeconds: number | null, candidates: StoryClip[]) {
  if (candidates.length === 0) {
    return { clips: [] as StoryClip[], filled: false }
  }
  if (durationSeconds == null) {
    return { clips: [candidates[0]], filled: true }
  }

  const clips: StoryClip[] = []
  let remain = durationSeconds
  for (const candidate of candidates) {
    if (remain <= 0.2) {
      break
    }
    const seconds = Math.min(candidate.seconds, remain)
    if (seconds < 0.4) {
      continue
    }
    clips.push({
      ...candidate,
      seconds,
      end: candidate.photo ? null : candidate.start + seconds,
    })
    remain -= seconds
  }
  const covered = clips.reduce((sum, clip) => sum + clip.seconds, 0)
  return { clips, filled: covered + 0.25 >= durationSeconds }
}
