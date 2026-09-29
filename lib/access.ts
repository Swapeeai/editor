// Production (the online copy) requires a magic-link sign-in.
// `npm run dev` is not production, so Suzanne's computer stays open with no login.
// The bypass is off whenever NODE_ENV is production, including on Render.

export function productionRequiresLogin() {
  return process.env.NODE_ENV === "production"
}

export function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"))
}

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }
  const list = allowedEmails()
  if (list.length === 0) {
    return false
  }
  return list.includes(email.trim().toLowerCase())
}

export function safeNextPath(value: string | null | undefined) {
  if (!value) {
    return "/"
  }
  const path = value.trim()
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    return "/"
  }
  if (path.startsWith("/login") || path.startsWith("/auth/")) {
    return "/"
  }
  return path
}

export function publicOrigin(request: Request) {
  const render = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, "")
  if (render) {
    return render
  }
  const site = process.env.SITE_URL?.trim().replace(/\/$/, "")
  if (site) {
    return site
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const proto = request.headers.get("x-forwarded-proto") ?? "https"
  if (host) {
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`
  }
  return new URL(request.url).origin
}
