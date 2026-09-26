import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const sql = await readFile(join(process.cwd(), "supabase/schema-update.sql"), "utf8")
  return NextResponse.json({ sql })
}
