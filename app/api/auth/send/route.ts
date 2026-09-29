import { NextResponse } from "next/server"
import { isAllowedEmail, publicOrigin, safeNextPath } from "@/lib/access"
import { createSessionClient } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }

  const record = body as { email?: unknown; next?: unknown }
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : ""
  if (!email.includes("@") || email.includes(" ") || email.length > 200) {
    return NextResponse.json({ error: "Type the email address." }, { status: 400 })
  }
  if (!isAllowedEmail(email)) {
    return NextResponse.json({ error: "That email is not on the list." }, { status: 403 })
  }

  const supabase = await createSessionClient()
  if (!supabase) {
    return NextResponse.json({ error: "Sign-in is not configured on the server yet." }, { status: 503 })
  }

  const next = safeNextPath(typeof record.next === "string" ? record.next : "/")
  const origin = publicOrigin(request)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  })
  if (error) {
    return NextResponse.json({ error: "Could not send the sign-in link." }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
