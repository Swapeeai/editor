import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { settingsBlocked } from "@/lib/settings-guard"
import { isTwelveLabsConfigured } from "@/lib/twelvelabs"

export const dynamic = "force-dynamic"

async function testTwelveLabs() {
  const key = process.env.TWELVE_LABS_API_KEY?.trim() ?? ""
  if (!key) {
    return { connected: false, message: "Not connected. Paste the Twelve Labs API key and save it." }
  }
  if (!isTwelveLabsConfigured()) {
    return { connected: false, message: "Not connected." }
  }
  const response = await fetch("https://api.twelvelabs.io/v1.3/indexes?page_limit=1", {
    headers: { "x-api-key": key },
  })
  const text = await response.text()
  if (!response.ok) {
    let message = "Twelve Labs refused the key."
    try {
      const body = JSON.parse(text) as { message?: string; error?: string }
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim().slice(0, 240)
      } else if (typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim().slice(0, 240)
      }
    } catch {
      message = "Twelve Labs refused the key."
    }
    if (message.includes(key)) {
      message = "Twelve Labs refused the key."
    }
    return { connected: false, message }
  }
  return { connected: true, message: "Connected. Twelve Labs listed indexes." }
}

async function testSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
  if (!url || !anon || !service) {
    return {
      connected: false,
      message: "Not connected. The URL, anon key, and service role key are all required.",
    }
  }
  const supabase = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const listed = await supabase.from("media_items").select("id").limit(1)
  if (listed.error) {
    return {
      connected: false,
      message: listed.error.message.slice(0, 240) || "Could not read the library.",
    }
  }
  const count = listed.data?.length ?? 0
  return {
    connected: true,
    message:
      count === 1
        ? "Connected. Read one library row."
        : "Connected. The library table is empty, and the read succeeded.",
  }
}

async function testGoogle() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim() ?? ""
  if (!clientId || !appId) {
    return { connected: false, message: "Not connected. Paste the Google client id and app id." }
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", "http://localhost:43123")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid")
  const response = await fetch(url, { redirect: "manual" })
  const text = (await response.text()).slice(0, 500).toLowerCase()
  if (text.includes("invalid_client") || text.includes("deleted_client")) {
    return { connected: false, message: "Google does not recognise that client id." }
  }
  if (
    response.status >= 300 && response.status < 400 ||
    text.includes("redirect_uri_mismatch") ||
    text.includes("accounts.google.com") ||
    response.status === 200
  ) {
    return {
      connected: true,
      message: "Connected. Google accepted the client id. Sign in on Upload to confirm the app id.",
    }
  }
  return { connected: false, message: "Google did not accept that client id." }
}

export async function POST(request: Request) {
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
  const service = (body as { service?: unknown }).service
  if (service !== "twelvelabs" && service !== "supabase" && service !== "google") {
    return NextResponse.json({ error: "Choose a service to test." }, { status: 400 })
  }

  try {
    const result =
      service === "twelvelabs"
        ? await testTwelveLabs()
        : service === "supabase"
          ? await testSupabase()
          : await testGoogle()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({
      connected: false,
      message: "The test could not reach that service.",
    })
  }
}
