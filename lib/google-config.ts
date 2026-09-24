// Public Google values. They are safe to ship to the browser.
// They are not the Supabase service role key.

export function getGoogleDriveConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ?? ""
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim() ?? ""
  if (!clientId || !apiKey || !appId) {
    return null
  }
  return { clientId, apiKey, appId }
}
