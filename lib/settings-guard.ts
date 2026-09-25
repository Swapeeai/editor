import "server-only"

import { NextResponse } from "next/server"
import { isLocalDevHost } from "@/lib/local-settings"

export function settingsBlocked(request: Request) {
  const host = request.headers.get("host")
  if (!isLocalDevHost(host)) {
    return NextResponse.json({ error: "Settings are only available on this computer." }, { status: 404 })
  }
  return null
}
