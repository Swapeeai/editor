import { NextResponse } from "next/server"
import {
  SETTING_FIELDS,
  currentSetting,
  maskSecret,
  saveLocalSettings,
  type SettingKey,
} from "@/lib/local-settings"
import { settingsBlocked } from "@/lib/settings-guard"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
  const blocked = settingsBlocked(request)
  if (blocked) {
    return blocked
  }

  const fields = SETTING_FIELDS.map((field) => {
    const value = currentSetting(field.key)
    return {
      key: field.key,
      label: field.label,
      secret: field.secret,
      set: Boolean(value),
      masked: field.secret ? maskSecret(value) : value,
    }
  })
  return NextResponse.json({ fields })
}

export async function POST(request: Request) {
  const denied = await productionGate()
  if (denied) return denied
  const blocked = settingsBlocked(request)
  if (blocked) {
    return blocked
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = (body ?? {}) as Partial<Record<SettingKey, unknown>>
  const updates: Partial<Record<SettingKey, string>> = {}
  for (const field of SETTING_FIELDS) {
    const value = record[field.key]
    if (typeof value !== "string") {
      continue
    }
    const text = value.trim()
    if (!text) {
      continue
    }
    if (field.key === "NEXT_PUBLIC_MAX_UPLOAD_MB") {
      const parsed = Number(text)
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
        return NextResponse.json(
          { error: "Max upload MB must be a number from 1 to 10000." },
          { status: 400 },
        )
      }
      updates[field.key] = String(Math.floor(parsed))
      continue
    }
    if (/[\r\n]/.test(text) || text.length > 2000) {
      return NextResponse.json({ error: "One of the values could not be saved." }, { status: 400 })
    }
    updates[field.key] = text
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Paste a value to save, or leave a saved key blank to keep it." }, { status: 400 })
  }

  try {
    const result = await saveLocalSettings(updates)
    const fields = SETTING_FIELDS.map((field) => {
      const value = currentSetting(field.key)
      return {
        key: field.key,
        set: Boolean(value),
        masked: field.secret ? maskSecret(value) : value,
      }
    })
    return NextResponse.json({ saved: result.saved, fields })
  } catch {
    return NextResponse.json({ error: "Could not write .env.local." }, { status: 500 })
  }
}
