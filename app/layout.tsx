import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { ProjectProvider } from "@/components/project-provider"
import { SearchProvider } from "@/components/search-provider"
import { SiteHeader } from "@/components/site-header"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Retreat Content Library",
  description:
    "A private place for pole-retreat photos and videos, plus a vertical export.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SearchProvider>
          <Suspense
            fallback={
              <div className="border-b border-t-4 border-t-primary px-4 py-4">
                <p className="font-semibold">Retreat Content Library</p>
              </div>
            }
          >
            <ProjectProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
            </ProjectProvider>
          </Suspense>
        </SearchProvider>
      </body>
    </html>
  )
}
