import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
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
    "A private place for pole-retreat photos and videos, plus a sample storyboard.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SearchProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </SearchProvider>
      </body>
    </html>
  )
}
