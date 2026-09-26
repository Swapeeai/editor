"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function SchemaBanner() {
  const [sql, setSql] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/schema", { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { sql?: string }
        if (response.ok && typeof body.sql === "string") {
          setSql(body.sql)
        }
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  async function copySql() {
    if (!sql) {
      return
    }
    await navigator.clipboard.writeText(sql)
    setCopied(true)
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3" role="status">
      <p className="text-sm font-medium">Database update needed</p>
      <p className="text-sm text-muted-foreground">
        Paste it in the Supabase SQL editor (left menu, then SQL), then click Run. It is safe if some of it already exists.
      </p>
      <div>
        <Button type="button" variant="outline" onClick={() => void copySql()} disabled={!sql}>
          {copied ? "Copied" : "Copy SQL"}
        </Button>
      </div>
    </div>
  )
}
