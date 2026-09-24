// Reads the two Supabase names from the environment.
// This file does not call Supabase. It does not create a bucket.
// Until both values are filled in, saving stays off.

const urlName = "NEXT_PUBLIC_SUPABASE_URL"
const keyName = "NEXT_PUBLIC_SUPABASE_ANON_KEY"

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env[urlName]?.trim()
  const anonKey = process.env[keyName]?.trim()
  if (!url || !anonKey) {
    return null
  }
  return { url, anonKey }
}

export function supabaseSetupMessage() {
  if (getSupabaseConfig()) {
    return "The Supabase values are filled in, but this version still only previews the file on your computer. It does not upload yet."
  }
  return "Saving to the cloud starts after you paste NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. They are empty right now, so nothing is saved."
}
