"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SearchBox } from "@/components/search-box"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/library", label: "Media Library" },
  { href: "/create-video", label: "Create Video" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-10 border-b border-t-4 border-t-primary bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Retreat Content Library
          </Link>
          <nav className="flex flex-wrap gap-2" aria-label="Main">
            {links.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>
        <SearchBox />
      </div>
    </header>
  )
}
