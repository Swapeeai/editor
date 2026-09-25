// iPhone photos are often HEIC. heic-convert decodes them with libheif compiled
// to JavaScript (WebAssembly), then the browser writes a JPEG. Nothing else
// has to be installed on Windows. Sharp is not used: its Windows build often
// cannot read HEIC.

export const HEIC_CONVERT_MESSAGE = "Converting from iPhone format…"

export const HEIC_FAIL_MESSAGE =
  "Couldn't convert this iPhone photo. Try exporting it as JPEG from Photos."

const HEIC_MIME = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
])

type HeicConvert = (options: {
  buffer: Uint8Array
  format: "JPEG"
  quality?: number
}) => Promise<Uint8Array>

export function isHeicFile(file: { type: string; name: string }) {
  const type = file.type.toLowerCase().split(";")[0]?.trim() ?? ""
  if (HEIC_MIME.has(type)) {
    return true
  }
  return /\.(heic|heif)$/i.test(file.name)
}

export function jpegNameFromHeic(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() || "photo"
  if (/\.(heic|heif)$/i.test(base)) {
    return base.replace(/\.(heic|heif)$/i, ".jpg")
  }
  const stem = base.replace(/\.[^.]+$/, "")
  return `${stem || "photo"}.jpg`
}

export function isStoredHeic(item: {
  mimeType?: string | null
  title?: string | null
  storagePath?: string | null
  fileName?: string | null
}) {
  const type = (item.mimeType ?? "").toLowerCase().split(";")[0]?.trim() ?? ""
  if (HEIC_MIME.has(type)) {
    return true
  }
  return [item.fileName, item.title, item.storagePath].some(
    (name) => typeof name === "string" && /\.(heic|heif)$/i.test(name),
  )
}

export function jpegTitleForStored(item: {
  title?: string | null
  fileName?: string | null
}) {
  const titled = item.title?.trim() ?? ""
  if (/\.(heic|heif)$/i.test(titled)) {
    return jpegNameFromHeic(titled)
  }
  return jpegNameFromHeic(item.fileName || titled || "photo.heic")
}

export async function convertHeicToJpeg(file: File) {
  const loaded = (await import("heic-convert/browser")) as { default?: HeicConvert } & HeicConvert
  const convert = loaded.default ?? loaded
  const buffer = new Uint8Array(await file.arrayBuffer())
  const jpeg = await convert({
    buffer,
    format: "JPEG",
    quality: 0.9,
  })
  const name = jpegNameFromHeic(file.name)
  const copy = new ArrayBuffer(jpeg.byteLength)
  new Uint8Array(copy).set(jpeg)
  return new File([copy], name, { type: "image/jpeg" })
}
