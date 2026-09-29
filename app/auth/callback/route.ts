import { NextResponse } from "next/server"
import { isAllowedEmail, publicOrigin, safeNextPath } from "@/lib/access"
import { createSessionClient } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = publicOrigin(request)
  const next = safeNextPath(url.searchParams.get("next"))
  const code = url.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link`)
  }

  const supabase = await createSessionClient()
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=config`)
  }

  const exchanged = await supabase.auth.exchangeCodeForSession(code)
  if (exchanged.error) {
    return NextResponse.redirect(`${origin}/login?error=link`)
  }

  const { data } = await supabase.auth.getUser()
  if (!isAllowedEmail(data.user?.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not-allowed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
