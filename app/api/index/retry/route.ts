import { NextResponse } from "next/server"
import { retryMedia } from "@/lib/ai-index"
import { IndexSchemaError } from "@/lib/media-db"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The request was empty." }, { status: 400 })
  }
  const id = (body as { id?: unknown }).id
  if (typeof id !== "string" || !UUID.test(id)) {
    return NextResponse.json({ error: "That file could not be found." }, { status: 400 })
  }

  try {
    const result = await retryMedia(id)
    if (!result.ok) {
      return NextResponse.json({ error: result.message })
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof IndexSchemaError) {
      return NextResponse.json({ error: error.message })
    }
    const message = error instanceof Error ? error.message : "Could not retry indexing."
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
