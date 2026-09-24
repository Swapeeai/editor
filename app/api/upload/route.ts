import { NextResponse } from "next/server"
import { isProjectId } from "@/lib/projects"
import { mediaTypeFromFile, safeFileName, titleFromFileName } from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"
import { FILE_TOO_BIG_MESSAGE, MAX_UPLOAD_BYTES } from "@/lib/upload-limit"

export const dynamic = "force-dynamic"

// Asks Storage for a short-lived upload link. The file itself does not come
// through this route, so a large video is not cut off at 10 MB.

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "The upload request was empty or too hard to read." },
      { status: 400 },
    )
  }

  const record = body as {
    projectId?: unknown
    fileName?: unknown
    mimeType?: unknown
    size?: unknown
  }
  const projectId = typeof record.projectId === "string" ? record.projectId : ""
  const fileName = typeof record.fileName === "string" ? record.fileName : ""
  const mimeType = typeof record.mimeType === "string" ? record.mimeType : ""
  const size = typeof record.size === "number" ? record.size : Number.NaN

  if (!isProjectId(projectId)) {
    return NextResponse.json(
      {
        error:
          "Pick a project first: Ibiza Pole Retreat, Phuket Pole Retreat, or Flirty Fitness.",
      },
      { status: 400 },
    )
  }

  if (!fileName || !Number.isFinite(size) || size <= 0) {
    return NextResponse.json(
      { error: "Choose a photo or a video first." },
      { status: 400 },
    )
  }

  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: FILE_TOO_BIG_MESSAGE }, { status: 413 })
  }

  const mediaType = mediaTypeFromFile({ type: mimeType, name: fileName })
  if (!mediaType) {
    return NextResponse.json(
      { error: "Choose a photo or a video." },
      { status: 400 },
    )
  }

  const id = crypto.randomUUID()
  const storagePath = `${projectId}/${id}-${safeFileName(fileName)}`
  const signed = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (signed.error || !signed.data?.signedUrl) {
    const missingBucket = /bucket/i.test(signed.error?.message ?? "")
    return NextResponse.json(
      {
        error: missingBucket
          ? "Could not save the file. Create a private Storage bucket named media, then try again."
          : "Could not start the upload. Nothing was added to the library.",
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    id,
    projectId,
    title: titleFromFileName(fileName),
    mediaType,
    storagePath,
    mimeType: mimeType || null,
    signedUrl: signed.data.signedUrl,
  })
}
