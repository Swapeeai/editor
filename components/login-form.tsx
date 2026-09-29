"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function LoginForm({ nextPath, error }: { nextPath: string; error: string | null }) {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(error)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    setMessage(null)
    try {
      const response = await fetch("/api/auth/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(body.error || "Could not send the sign-in link.")
      }
      setMessage("Check that inbox for the sign-in link. It expires soon.")
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "Could not send the sign-in link.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email link</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Email</span>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              className="h-10"
            />
          </label>
          <Button type="submit" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send sign-in link"}
          </Button>
          {message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {message}
            </p>
          ) : null}
          {problem ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {problem}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
