// Safe to import from the browser.
// This file never reads SUPABASE_SERVICE_ROLE_KEY.
// The server check lives in lib/supabase-admin.ts.

export const NOT_CONNECTED_MESSAGE =
  "Supabase is not connected. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in .env.local, then restart the app."
