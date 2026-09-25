"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Field = {
  key: string
  label: string
  secret: boolean
  set: boolean
  masked: string
}

type TestState = {
  connected: boolean | null
  message: string
}

const SERVICES: { id: "twelvelabs" | "supabase" | "google"; label: string; keys: string[] }[] = [
  { id: "twelvelabs", label: "Twelve Labs", keys: ["TWELVE_LABS_API_KEY"] },
  {
    id: "supabase",
    label: "Supabase",
    keys: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
  },
  {
    id: "google",
    label: "Google",
    keys: ["NEXT_PUBLIC_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_APP_ID"],
  },
]

const RESTART = "npm run dev"

export function SettingsForm() {
  const [fields, setFields] = useState<Field[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, TestState>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/settings", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { error?: string; fields?: Field[] }
        if (!response.ok) {
          throw new Error(body.error || "Could not read settings.")
        }
        setFields(body.fields ?? [])
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") {
          return
        }
        setError(caught instanceof Error ? caught.message : "Could not read settings.")
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [])

  function statusFor(keys: string[]) {
    const relevant = fields.filter((field) => keys.includes(field.key))
    if (relevant.length === 0 || relevant.some((field) => !field.set)) {
      return "Not connected"
    }
    return "Saved"
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setSavedNote(null)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts),
      })
      const body = (await response.json()) as { error?: string; fields?: Field[] }
      if (!response.ok) {
        throw new Error(body.error || "Could not save settings.")
      }
      if (body.fields) {
        setFields((current) =>
          current.map((field) => {
            const next = body.fields?.find((item) => item.key === field.key)
            return next ? { ...field, set: next.set, masked: next.masked } : field
          }),
        )
      } else {
        const again = await fetch("/api/settings")
        const fresh = (await again.json()) as { fields?: Field[] }
        if (again.ok) {
          setFields(fresh.fields ?? [])
        }
      }
      setDrafts({})
      setSavedNote("Saved. Twelve Labs, Supabase, and the server upload limit are already using the new values.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  async function testService(service: (typeof SERVICES)[number]["id"]) {
    setTesting(service)
    setTests((current) => ({ ...current, [service]: { connected: null, message: "Testing…" } }))
    try {
      const response = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      })
      const body = (await response.json()) as { connected?: boolean; message?: string; error?: string }
      setTests((current) => ({
        ...current,
        [service]: {
          connected: Boolean(body.connected),
          message: body.message || body.error || "The test did not finish.",
        },
      }))
    } catch {
      setTests((current) => ({
        ...current,
        [service]: { connected: false, message: "The test could not reach that service." },
      }))
    } finally {
      setTesting(null)
    }
  }

  async function copyRestart() {
    try {
      await navigator.clipboard.writeText(RESTART)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-base text-muted-foreground">
          Paste keys here. They are saved in .env.local on this computer. A saved key is shown masked. Leave a box blank to keep the current value.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This page stays on your computer</CardTitle>
          <CardDescription>
            There is no login. Settings are turned off if this app is hosted. Do not put the app on the public internet.
          </CardDescription>
        </CardHeader>
      </Card>

      {SERVICES.map((service) => {
        const test = tests[service.id]
        const label = test?.connected
          ? "Connected"
          : test && test.connected === false
            ? "Not connected"
            : statusFor(service.keys)
        return (
          <Card key={service.id}>
            <CardHeader>
              <CardTitle>{service.label}</CardTitle>
              <CardDescription>
                <span className={label === "Connected" ? "font-medium text-foreground" : "font-medium"}>
                  {label}
                </span>
                {test?.message ? ` · ${test.message}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {fields
                .filter((field) => service.keys.includes(field.key))
                .map((field) => (
                  <label key={field.key} className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{field.label}</span>
                    <Input
                      type={field.secret ? "password" : "text"}
                      autoComplete="off"
                      value={drafts[field.key] ?? ""}
                      placeholder={field.set ? field.masked || "Saved" : "Paste the value"}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      className="h-10"
                    />
                  </label>
                ))}
              <Button
                type="button"
                variant="outline"
                disabled={testing === service.id}
                onClick={() => void testService(service.id)}
              >
                {testing === service.id ? "Testing…" : "Test"}
              </Button>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle>Max upload</CardTitle>
          <CardDescription>
            {fields.find((field) => field.key === "NEXT_PUBLIC_MAX_UPLOAD_MB")?.set
              ? `Using ${fields.find((field) => field.key === "NEXT_PUBLIC_MAX_UPLOAD_MB")?.masked} MB on the server.`
              : "Using 5000 MB until you set a number. That is 5 GB."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Max upload MB</span>
            <Input
              inputMode="numeric"
              value={drafts.NEXT_PUBLIC_MAX_UPLOAD_MB ?? ""}
              placeholder={
                fields.find((field) => field.key === "NEXT_PUBLIC_MAX_UPLOAD_MB")?.masked || "5000"
              }
              onChange={(event) =>
                setDrafts((current) => ({
                  ...current,
                  NEXT_PUBLIC_MAX_UPLOAD_MB: event.target.value,
                }))
              }
              className="h-10 w-40"
            />
          </label>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Reading saved keys…</p> : null}
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {savedNote ? (
        <p className="text-sm text-muted-foreground" role="status">
          {savedNote}
        </p>
      ) : null}

      <Button type="submit" disabled={saving || loading}>
        {saving ? "Saving…" : "Save"}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Restart for Google and the Upload page</CardTitle>
          <CardDescription>
            Twelve Labs, Supabase, and the server upload limit change as soon as you save. Google sign-in and the upload limit written on the Upload page are already loaded in the browser, so those two need a restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-2">
          <p className="text-sm">In the terminal where the app is running, press Ctrl+C, then run:</p>
          <code className="rounded-lg bg-muted px-3 py-2 text-sm">{RESTART}</code>
          <Button type="button" variant="outline" onClick={() => void copyRestart()}>
            {copied ? "Copied" : "Copy command"}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
