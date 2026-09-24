import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Files are stored in this private bucket.
// The object key inside the bucket is {project_id}/{uuid}-{safeFileName}.
export const MEDIA_BUCKET = "media"

function trimmed(name: string) {
  return process.env[name]?.trim() ?? ""
}

export function isSupabaseConfigured() {
  return Boolean(
    trimmed("NEXT_PUBLIC_SUPABASE_URL") &&
      trimmed("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      trimmed("SUPABASE_SERVICE_ROLE_KEY"),
  )
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = trimmed("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = trimmed("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const serviceKey = trimmed("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !anonKey || !serviceKey) {
    return null
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
