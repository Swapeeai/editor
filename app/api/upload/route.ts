import { NextResponse } from "next/server"
import { isProjectId } from "@/lib/projects"
import {
  mediaTypeFromFile,
  rowToSavedMedia,
  safeFileName,
  titleFromFileName,
  type MediaRow,
} from "@/lib/saved-media"
import { NOT_CONNECTED_MESSAGE } from "@/lib/supabase"
import { getSupabaseAdmin, MEDIA_BUCKET } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: NOT_CONNECTED_MESSAGE }, { status: 503 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "The upload form was empty or too hard to read." },
      { status: 400 },
    )
  }

  const projectValue = form.get("projectId")
  const projectId = typeof projectValue === "string" ? projectValue : ""
  if (!isProjectId(projectId)) {
    return NextResponse.json(
      { error: "Pick a project first: Ibiza, Phuket, or Flati." },
      { status: 400 },
    )
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Choose a photo or a video first." },
      { status: 400 },
    )
  }

  const mediaType = mediaTypeFromFile(file)
  if (!mediaType) {
    return NextResponse.json(
      { error: "Choose a photo or a video." },
      { status: 400 },
    )
  }

  const id = crypto.randomUUID()
  const storagePath = `${projectId}/${id}-${safeFileName(file.name)}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const uploaded = await supabase.storage.from(MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  })

  if (uploaded.error) {
    const missingBucket = /bucket/i.test(uploaded.error.message)
    return NextResponse.json(
      {
        error: missingBucket
          ? "Could not save the file. Create a private Storage bucket named media, then try again."
          : "Could not save the file to Storage. Nothing was added to the library.",
      },
      { status: 502 },
    )
  }

  const inserted = await supabase
    .from("media_items")
    .insert({
      id,
      project_id: projectId,
      title: titleFromFileName(file.name),
      media_type: mediaType,
      storage_path: storagePath,
      mime_type: file.type || null,
    })
    .select(
      "id, project_id, title, media_type, storage_path, mime_type, created_at",
    )
    .single()

  if (inserted.error || !inserted.data) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath])
    const missingTable = /media_items|relation/i.test(inserted.error?.message ?? "")
    return NextResponse.json(
      {
        error: missingTable
          ? "The media_items table is missing. Paste supabase/schema.sql in the Supabase SQL editor, then try again."
          : "The library row could not be saved, so the file was removed from Storage.",
      },
      { status: 502 },
    )
  }

  const signed = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  return NextResponse.json({
    item: rowToSavedMedia(inserted.data as MediaRow, signed.data?.signedUrl ?? null),
  })
}
