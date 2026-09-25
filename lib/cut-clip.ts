import "server-only"

import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const require = createRequire(import.meta.url)

function ffmpegBinary() {
  const found = require("ffmpeg-static") as string | null
  if (!found) {
    throw new Error("The video tool is missing. Run npm install, then restart the app.")
  }
  return found
}

function runFfmpeg(args: string[], onTime?: (seconds: number) => void) {
  const binary = ffmpegBinary()
  return new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] })
    let err = ""
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      err = (err + text).slice(-2000)
      const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text)
      if (match && onTime) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
        if (Number.isFinite(seconds)) {
          onTime(seconds)
        }
      }
    })
    child.on("error", () => {
      reject(new Error("The video tool is missing. Run npm install, then restart the app."))
    })
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(err.trim() || "Could not cut that part."))
    })
  })
}

export async function probeDuration(filePath: string) {
  const binary = ffmpegBinary()
  const err = await new Promise<string>((resolve) => {
    const child = spawn(binary, ["-i", filePath], { stdio: ["ignore", "ignore", "pipe"] })
    let text = ""
    child.stderr.on("data", (chunk: Buffer) => {
      text += chunk.toString()
    })
    child.on("close", () => resolve(text))
    child.on("error", () => resolve(text))
  })
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err)
  if (!match) {
    return null
  }
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export async function cutVideoFile(
  inputPath: string,
  start: number,
  end: number,
  onProgress?: (label: string) => void,
) {
  const duration = end - start
  if (!(duration >= 0.2)) {
    throw new Error("Choose at least 0.2 seconds.")
  }
  const dir = await mkdtemp(join(tmpdir(), "retreat-cut-"))
  const output = join(dir, "part.mp4")
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true })
  }

  try {
    onProgress?.("Cutting without re-encoding…")
    let copiedClean = false
    try {
      await runFfmpeg([
        "-y",
        "-ss",
        start.toFixed(3),
        "-i",
        inputPath,
        "-t",
        duration.toFixed(3),
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        output,
      ])
      const copied = await probeDuration(output)
      const copiedSize = await stat(output).then((info) => info.size).catch(() => 0)
      copiedClean =
        copied != null &&
        copiedSize > 1000 &&
        copied + 0.35 >= duration &&
        copied <= duration + 0.35
    } catch {
      copiedClean = false
    }
    if (copiedClean) {
      return { path: output, dir, mode: "copy" as const, cleanup }
    }

    onProgress?.("Re-encoding this part for a clean cut…")
    await runFfmpeg(
      [
        "-y",
        "-ss",
        start.toFixed(3),
        "-i",
        inputPath,
        "-t",
        duration.toFixed(3),
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        output,
      ],
      (seconds) => {
        const fraction = Math.max(0, Math.min(1, seconds / duration))
        onProgress?.(`Re-encoding this part… ${Math.round(fraction * 100)}%`)
      },
    )
    const encoded = await probeDuration(output)
    if (encoded == null || encoded < 0.15) {
      throw new Error("The cut file was empty. Try a slightly different start or end.")
    }
    return { path: output, dir, mode: "encode" as const, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
