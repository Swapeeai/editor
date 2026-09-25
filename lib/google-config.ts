// Public Google values. They are safe to ship to the browser.
// They are not the Supabase service role key.
//
// The API key is optional. The file window uses the sign-in token and the
// project number. A bad key makes Google say the developer key is invalid.

const READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
const FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

function flagOn(value: string | undefined) {
  const text = value?.trim().toLowerCase() ?? ""
  return text === "yes" || text === "true" || text === "1"
}

export function getGoogleDriveConfig() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? ""
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim() ?? ""
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim() ?? ""
  if (!clientId || !appId) {
    return null
  }
  const driveReadonly = flagOn(process.env.NEXT_PUBLIC_GOOGLE_DRIVE_READONLY)
  return {
    clientId,
    appId,
    apiKey,
    driveReadonly,
    scope: driveReadonly ? READONLY_SCOPE : FILE_SCOPE,
  }
}
