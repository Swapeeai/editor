import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAllowedEmail, productionRequiresLogin, safeNextPath } from "@/lib/access"

const OPEN_PATH =
  /^\/login$|^\/auth\/callback$|^\/api\/auth\/send$|^\/api\/auth\/signout$/

export async function proxy(request: NextRequest) {
  if (!productionRequiresLogin()) {
    return NextResponse.next()
  }

  const path = request.nextUrl.pathname
  const open = OPEN_PATH.test(path)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  if (!url || !anonKey) {
    return open ? NextResponse.next() : deny(request, path)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const allowed = isAllowedEmail(data.user?.email)
  if (open || allowed) {
    return response
  }
  return deny(request, path)
}

function deny(request: NextRequest, path: string) {
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  }
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  const next = safeNextPath(`${path}${request.nextUrl.search}`)
  if (next !== "/") {
    url.searchParams.set("next", next)
  }
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
}
