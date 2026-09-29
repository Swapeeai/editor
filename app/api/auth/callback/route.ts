import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { isAllowedEmail, safeNextPath } from "@/lib/access"
import { createSessionClient } from "@/lib/session"

export const dynamic = "force-dynamic"

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max || /\s/.test(trimmed)) return null
  return trimmed
}

function bodyKeys(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return []
  return Object.keys(body)
}

function fail(step: "json" | "missing" | "session" | "code" | "otp", keys: string[], message?: string) {
  const payload: { error: string; keys: string[]; message?: string } = { error: step, keys }
  if (message) payload.message = message
  return NextResponse.json(payload, { status: 400 })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail("json", [])
  }

  const keys = bodyKeys(body)
  const record = (body ?? {}) as Record<string, unknown>
  const code = text(record.code, 2048)
  const accessToken = text(record.accessToken, 8192)
  const refreshToken = text(record.refreshToken, 4096)
  const tokenHash = text(record.tokenHash, 2048)
  const typeRaw = text(record.type, 32)
  const next = safeNextPath(typeof record.next === "string" ? record.next : "/")

  const supabase = await createSessionClient()
  if (!supabase) {
    return NextResponse.json({ error: "config", keys }, { status: 503 })
  }

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code)
    if (exchanged.error) {
      return fail("code", keys, exchanged.error.message)
    }
  } else if (accessToken && refreshToken) {
    const session = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (session.error) {
      return fail("session", keys, session.error.message)
    }
  } else if (tokenHash) {
    const type = typeRaw && OTP_TYPES.has(typeRaw as EmailOtpType) ? (typeRaw as EmailOtpType) : "magiclink"
    const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (verified.error) {
      return fail("otp", keys, verified.error.message)
    }
  } else {
    return fail("missing", keys)
  }

  const { data } = await supabase.auth.getUser()
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: "not-allowed" }, { status: 403 })
  }

  return NextResponse.json({ next })
}
