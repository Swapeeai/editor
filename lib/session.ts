import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { isAllowedEmail } from "@/lib/access"

export async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  if (!url || !anonKey) {
    return null
  }
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // A Server Component cannot always write cookies. The proxy refreshes the session.
        }
      },
    },
  })
}

export async function readAllowedUser() {
  const supabase = await createSessionClient()
  if (!supabase) {
    return null
  }
  const { data, error } = await supabase.auth.getUser()
  const email = data.user?.email
  if (error || !email || !isAllowedEmail(email)) {
    return null
  }
  return { email: email.trim().toLowerCase() }
}
