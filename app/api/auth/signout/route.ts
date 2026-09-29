import { NextResponse } from "next/server"
import { publicOrigin } from "@/lib/access"
import { createSessionClient } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = await createSessionClient()
  if (supabase) {
    await supabase.auth.signOut()
  }
  return NextResponse.redirect(`${publicOrigin(request)}/login`, { status: 303 })
}
