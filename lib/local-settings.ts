import "server-only"

import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

// Keys Suzanne can paste on the Settings page. Values are written to .env.local
// and copied into this running server. The browser never receives the full value.

export const SETTING_FIELDS = [
  { key: "TWELVE_LABS_API_KEY", label: "Twelve Labs API key", secret: true },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", secret: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase anon key", secret: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase service role key", secret: true },
  { key: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", label: "Google client id", secret: true },
  { key: "NEXT_PUBLIC_GOOGLE_APP_ID", label: "Google app id", secret: true },
  { key: "NEXT_PUBLIC_MAX_UPLOAD_MB", label: "Max upload MB", secret: false },
] as const

export type SettingKey = (typeof SETTING_FIELDS)[number]["key"]

const ALLOWED = new Set<string>(SETTING_FIELDS.map((field) => field.key))

export function isLocalDevHost(host: string | null) {
  if (process.env.NODE_ENV === "production") {
    return false
  }
  const name = (host ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "")
  const hostname = name.split(":")[0]
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

export function maskSecret(value: string) {
  const text = value.trim()
  if (!text) {
    return ""
  }
  if (text.length <= 4) {
    return "••••"
  }
  return `••••••••${text.slice(-4)}`
}

export function currentSetting(key: SettingKey) {
  return process.env[key]?.trim() ?? ""
}

export function mergeEnvText(current: string, updates: Record<string, string>) {
  const lines = current.split(/\r?\n/)
  const seen = new Set<string>()
  const next = lines.map((line) => {
    const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line)
    if (!match || !(match[1] in updates)) {
      return line
    }
    seen.add(match[1])
    return `${match[1]}=${updates[match[1]]}`
  })
  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) {
      continue
    }
    if (next.length > 0 && next[next.length - 1] !== "") {
      next.push("")
    }
    next.push(`${key}=${value}`)
  }
  const text = next.join("\n")
  return text.endsWith("\n") ? text : `${text}\n`
}

function envPath() {
  return join(process.cwd(), ".env.local")
}

export async function saveLocalSettings(updates: Partial<Record<SettingKey, string>>) {
  const clean: Record<string, string> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED.has(key) || typeof value !== "string") {
      continue
    }
    const text = value.trim()
    if (!text || /[\r\n]/.test(text)) {
      continue
    }
    clean[key] = text
  }
  if (Object.keys(clean).length === 0) {
    return { saved: [] as string[] }
  }

  let current = ""
  try {
    current = await readFile(envPath(), "utf8")
  } catch {
    current = ""
  }
  await writeFile(envPath(), mergeEnvText(current, clean), { encoding: "utf8" })
  for (const [key, value] of Object.entries(clean)) {
    process.env[key] = value
  }
  return { saved: Object.keys(clean) }
}
