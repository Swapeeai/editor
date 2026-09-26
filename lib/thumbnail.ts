import "server-only"

import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { probeDuration } from "@/lib/cut-clip"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

const require = createRequire(import.meta.url)
const DARK = 22

function ffmpegBinary() {
  const found = require("ffmpeg-static") as string | null
  if (!found) {
    throw new Error("The video tool is missing. Run npm install, then restart the app.")
  }
  return found
}

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegBinary(), args, { stdio: ["ignore", "ignore", "pipe"] })
    child.on("error", () => reject(new Error("Could not read a frame from this video.")))
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error("Could not read a frame from this video."))
    })
  })
}

async function brightnessOf(jpegPath: string, dir: string) {
  const rawPath = join(dir, "gray.raw")
  await run(["-y", "-i", jpegPath, "-vf", "scale=16:16,format=gray", "-f", "rawvideo", rawPath])
  const raw = await readFile(rawPath)
  if (raw.length === 0) {
    return 0
  }
  let total = 0
  for (const value of raw) {
    total += value
  }
  return total / raw.length
}

async function frameAt(inputPath: string, seconds: number, dir: string, name: string) {
  const jpegPath = join(dir, name)
  await run([
    "-y",
    "-ss",
    Math.max(0, seconds).toFixed(3),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "3",
    jpegPath,
  ])
  const info = await stat(jpegPath)
  if (info.size < 400) {
    return null
  }
  return { jpegPath, brightness: await brightnessOf(jpegPath, dir) }
}

export async function extractThumbnail(inputPath: string, durationHint?: number | null) {
  const dir = await mkdtemp(join(tmpdir(), "retreat-thumb-"))
  try {
    const duration = durationHint && durationHint > 0 ? durationHint : await probeDuration(inputPath)
    const length = duration && duration > 0 ? duration : 2
    const firstAt = length > 1.2 ? 1 : Math.max(0, length * 0.5)
    const first = await frameAt(inputPath, firstAt, dir, "first.jpg")
    let chosen = first
    if (!first || first.brightness < DARK) {
      const samples = [length * 0.1, length * 0.25, length * 0.5].filter(
        (seconds) => seconds > 0.05 && seconds < length - 0.05,
      )
      for (const [index, seconds] of samples.entries()) {
        const frame = await frameAt(inputPath, seconds, dir, `sample-${index}.jpg`).catch(() => null)
        if (frame && (!chosen || frame.brightness > chosen.brightness)) {
          chosen = frame
        }
      }
    }
    if (!chosen) {
      throw new Error("Could not read a frame from this video.")
    }
    return readFile(chosen.jpegPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function missingColumn(message: string) {
  return /thumbnail_path|schema cache|could not find|column/i.test(message)
}

export async function storeThumbnail(id: string, projectId: string, jpeg: Buffer) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return { ok: false as const, schema: false, message: "Supabase is not connected." }
  }
  const thumbnailPath = `${projectId}/thumbs/${id}.jpg`
  const uploaded = await supabase.storage.from(MEDIA_BUCKET).upload(thumbnailPath, jpeg, {
    contentType: "image/jpeg",
    upsert: true,
  })
  if (uploaded.error) {
    return { ok: false as const, schema: false, message: "Could not save the thumbnail." }
  }
  const updated = await supabase
    .from("media_items")
    .update({ thumbnail_path: thumbnailPath })
    .eq("id", id)
  if (updated.error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([thumbnailPath])
    if (missingColumn(updated.error.message)) {
      return {
        ok: false as const,
        schema: true,
        message:
          "Database update needed. Copy the SQL from the banner in the library and paste it in the Supabase SQL editor.",
      }
    }
    return { ok: false as const, schema: false, message: "Could not save the thumbnail." }
  }
  const signed = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(thumbnailPath, 60 * 60)
  return { ok: true as const, thumbnailPath, thumbnailUrl: signed.data?.signedUrl ?? null }
}

export async function thumbnailFromFile(id: string, projectId: string, filePath: string, durationHint?: number | null) {
  const jpeg = await extractThumbnail(filePath, durationHint)
  return storeThumbnail(id, projectId, jpeg)
}
