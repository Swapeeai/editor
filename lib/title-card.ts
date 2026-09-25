import { crc32, deflateSync } from "node:zlib"

// A 5×7 bitmap font. drawtext is missing from the bundled ffmpeg binary,
// so the title card is drawn here and handed to ffmpeg as a still image.

const GLYPHS: Record<string, number[]> = {
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0e, 0x11, 0x10, 0x0e, 0x01, 0x11, 0x0e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x04, 0x04, 0x04],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  ",": [0x00, 0x00, 0x00, 0x00, 0x0c, 0x04, 0x08],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  "'": [0x06, 0x06, 0x04, 0x00, 0x00, 0x00, 0x00],
  ":": [0x00, 0x0c, 0x0c, 0x00, 0x0c, 0x0c, 0x00],
  "/": [0x01, 0x02, 0x04, 0x08, 0x10, 0x00, 0x00],
}

const WIDTH = 1080
const HEIGHT = 1920
const SCALE = 8
const GLYPH_W = 5
const GLYPH_H = 7
const GAP = 1

function cleanLine(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 .,'\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
}

function wrapLine(text: string) {
  const maxChars = Math.floor(WIDTH / ((GLYPH_W + GAP) * SCALE))
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
    } else {
      if (current) {
        lines.push(current)
      }
      current = word.slice(0, maxChars)
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines.slice(0, 6)
}

function chunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([length, body, crc])
}

function pngRgba(pixels: Uint8Array) {
  const raw = Buffer.alloc((WIDTH * 4 + 1) * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * (WIDTH * 4 + 1)
    raw[row] = 0
    pixels.subarray(y * WIDTH * 4, (y + 1) * WIDTH * 4).forEach((byte, index) => {
      raw[row + 1 + index] = byte
    })
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(WIDTH, 0)
  ihdr.writeUInt32BE(HEIGHT, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function drawGlyphRgba(
  pixels: Uint8Array,
  glyph: number[],
  left: number,
  top: number,
) {
  for (let row = 0; row < GLYPH_H; row += 1) {
    for (let col = 0; col < GLYPH_W; col += 1) {
      if (((glyph[row] >> (4 - col)) & 1) === 0) {
        continue
      }
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const x = left + col * SCALE + sx
          const y = top + row * SCALE + sy
          if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
            continue
          }
          const offset = (y * WIDTH + x) * 4
          pixels[offset] = 255
          pixels[offset + 1] = 255
          pixels[offset + 2] = 255
          pixels[offset + 3] = 255
        }
      }
    }
  }
}

export function captionOverlayPng(lines: string[]) {
  const wrapped = lines
    .flatMap((line) => wrapLine(cleanLine(line)))
    .filter(Boolean)
    .slice(0, 4)
  if (wrapped.length === 0) {
    return null
  }
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  const lineHeight = (GLYPH_H + 3) * SCALE
  const blockHeight = wrapped.length * lineHeight
  const top = HEIGHT - blockHeight - 160
  const barTop = top - 36
  const barBottom = top + blockHeight + 36
  for (let y = Math.max(0, barTop); y < Math.min(HEIGHT, barBottom); y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = (y * WIDTH + x) * 4
      pixels[offset + 3] = 150
    }
  }
  wrapped.forEach((line, lineIndex) => {
    const width = line.length * (GLYPH_W + GAP) * SCALE
    const left = Math.max(40, Math.floor((WIDTH - width) / 2))
    const y = top + lineIndex * lineHeight
    for (let index = 0; index < line.length; index += 1) {
      const glyph = GLYPHS[line[index]] ?? GLYPHS[" "]
      drawGlyphRgba(pixels, glyph, left + index * (GLYPH_W + GAP) * SCALE, y)
    }
  })
  return pngRgba(pixels)
}

function png(pixels: Uint8Array) {
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT)
  for (let y = 0; y < HEIGHT; y += 1) {
    const row = y * (WIDTH * 3 + 1)
    raw[row] = 0
    pixels.subarray(y * WIDTH * 3, (y + 1) * WIDTH * 3).forEach((byte, index) => {
      raw[row + 1 + index] = byte
    })
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(WIDTH, 0)
  ihdr.writeUInt32BE(HEIGHT, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

function drawGlyph(pixels: Uint8Array, glyph: number[], left: number, top: number) {
  for (let row = 0; row < GLYPH_H; row += 1) {
    for (let col = 0; col < GLYPH_W; col += 1) {
      if (((glyph[row] >> (4 - col)) & 1) === 0) {
        continue
      }
      for (let sy = 0; sy < SCALE; sy += 1) {
        for (let sx = 0; sx < SCALE; sx += 1) {
          const x = left + col * SCALE + sx
          const y = top + row * SCALE + sy
          if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
            continue
          }
          const offset = (y * WIDTH + x) * 3
          pixels[offset] = 255
          pixels[offset + 1] = 255
          pixels[offset + 2] = 255
        }
      }
    }
  }
}

export function titleCardPng(lines: string[]) {
  const wrapped = lines.flatMap((line) => wrapLine(cleanLine(line))).filter(Boolean)
  if (wrapped.length === 0) {
    return null
  }
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3)
  for (let index = 0; index < pixels.length; index += 3) {
    pixels[index] = 28
    pixels[index + 1] = 25
    pixels[index + 2] = 23
  }
  const lineHeight = (GLYPH_H + 4) * SCALE
  const blockHeight = wrapped.length * lineHeight
  const top = Math.max(80, Math.floor((HEIGHT - blockHeight) / 2))
  wrapped.forEach((line, lineIndex) => {
    const width = line.length * (GLYPH_W + GAP) * SCALE
    const left = Math.max(40, Math.floor((WIDTH - width) / 2))
    const y = top + lineIndex * lineHeight
    for (let index = 0; index < line.length; index += 1) {
      const glyph = GLYPHS[line[index]] ?? GLYPHS[" "]
      drawGlyph(pixels, glyph, left + index * (GLYPH_W + GAP) * SCALE, y)
    }
  })
  return png(pixels)
}
