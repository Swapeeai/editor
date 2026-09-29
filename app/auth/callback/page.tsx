"use client"

import { useEffect, useState } from "react"

export default function AuthCallbackPage() {
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : ""
    const hash = new URLSearchParams(rawHash)
    const body = {
      code: search.get("code"),
      next: search.get("next"),
      accessToken: hash.get("access_token"),
      refreshToken: hash.get("refresh_token"),
      tokenHash: hash.get("token_hash") || search.get("token_hash"),
      type: hash.get("type") || search.get("type"),
      error: hash.get("error") || search.get("error"),
    }

    let cancelled = false
    fetch("/api/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { next?: string; error?: string }
        if (cancelled) return
        if (payload.error === "not-allowed") {
          window.location.replace("/login?error=not-allowed")
          return
        }
        if (!response.ok) {
          window.location.replace(`/login?error=${payload.error === "config" ? "config" : "link"}`)
          return
        }
        const next = payload.next && payload.next.startsWith("/") && !payload.next.startsWith("//") ? payload.next : "/"
        window.location.replace(next)
      })
      .catch(() => {
        if (!cancelled) setProblem("Sign-in did not work. Request a new link.")
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Signing in</h1>
      <p className="text-base leading-7 text-muted-foreground">{problem ?? "Checking the sign-in link."}</p>
    </div>
  )
}
