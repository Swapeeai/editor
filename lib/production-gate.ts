import "server-only"

import { NextResponse } from "next/server"
import { productionRequiresLogin } from "@/lib/access"
import { readAllowedUser } from "@/lib/session"

export async function productionGate() {
  if (!productionRequiresLogin()) {
    return null
  }
  const user = await readAllowedUser()
  if (user) {
    return null
  }
  return NextResponse.json({ error: "Sign in required." }, { status: 401 })
}
