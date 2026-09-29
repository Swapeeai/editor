import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { SettingsForm } from "@/components/settings-form"
import { isLocalDevHost } from "@/lib/local-settings"

export const metadata = {
  title: "Settings · Retreat Content Library",
}

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const host = (await headers()).get("host")
  if (!isLocalDevHost(host)) {
    notFound()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <SettingsForm />
    </div>
  )
}
