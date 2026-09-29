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

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "link" }, { status: 400 })
  }

  const record = body as Record<string, unknown>
  if (typeof record.error === "string" && record.error) {
    return NextResponse.json({ error: "link" }, { status: 400 })
  }

  const code = text(record.code, 2048)
  const accessToken = text(record.accessToken, 8192)
  const refreshToken = text(record.refreshToken, 4096)
  const tokenHash = text(record.tokenHash, 2048)
  const typeRaw = text(record.type, 32)
  const next = safeNextPath(typeof record.next === "string" ? record.next : "/")

  const supabase = await createSessionClient()
  if (!supabase) {
    return NextResponse.json({ error: "config" }, { status: 503 })
  }

  if (code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code)
    if (exchanged.error) {
      return NextResponse.json({ error: "link" }, { status: 400 })
    }
  } else if (accessToken && refreshToken) {
    const session = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (session.error) {
      return NextResponse.json({ error: "link" }, { status: 400 })
    }
  } else if (tokenHash) {
    const type = typeRaw && OTP_TYPES.has(typeRaw as EmailOtpType) ? (typeRaw as EmailOtpType) : "magiclink"
    const verified = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (verified.error) {
      return NextResponse.json({ error: "link" }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: "link" }, { status: 400 })
  }

  const { data } = await supabase.auth.getUser()
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: "not-allowed" }, { status: 403 })
  }

  return NextResponse.json({ next })
}
