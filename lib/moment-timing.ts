export const MAX_MOMENT_SECONDS = 30
export const DEFAULT_VIDEO_SECONDS = 5
export const PHOTO_SECONDS = 3

export function clipDuration(options: {
  photo: boolean
  start: number
  end: number | null
}) {
  if (options.photo) {
    return PHOTO_SECONDS
  }
  if (
    options.end != null &&
    Number.isFinite(options.end) &&
    options.end > options.start
  ) {
    return Math.min(MAX_MOMENT_SECONDS, Math.max(0.5, options.end - options.start))
  }
  return DEFAULT_VIDEO_SECONDS
}

export function formatTimestamp(seconds: number) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const minutes = Math.floor(safe / 60)
  const rest = Math.round((safe - minutes * 60) * 10) / 10
  const whole = Math.abs(rest - Math.round(rest)) < 0.05
  const text = whole
    ? String(Math.round(rest)).padStart(2, "0")
    : rest.toFixed(1).padStart(4, "0")
  return `${minutes}:${text}`
}
