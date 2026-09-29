import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

export async function GET() {
  const denied = await productionGate()
  if (denied) return denied
  const sql = await readFile(join(process.cwd(), "supabase/schema-update.sql"), "utf8")
  return NextResponse.json({ sql })
}
