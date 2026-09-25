// Safe to import from the browser.
// This file never reads SUPABASE_SERVICE_ROLE_KEY.
// The server check lives in lib/supabase-admin.ts.

export const NOT_CONNECTED_MESSAGE =
  "Supabase is not connected. Open Settings on this computer and paste the URL, anon key, and service role key."
