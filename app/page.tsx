import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-primary">Private library</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Retreat Content Library
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          This is your private place for pole-retreat photos and videos. You
          can preview a file on your own computer, browse sample cards, and
          ask for a storyboard of a social video.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          The library starts with made-up samples from two camps: Phuket Pole
          Camp 2026, which is the current one, and Bali Pole Retreat 2025,
          which is a past one.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/upload"
          className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}
        >
          Upload
        </Link>
        <Link
          href="/library"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-10 px-4",
          )}
        >
          Media Library
        </Link>
        <Link
          href="/create-video"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-10 px-4",
          )}
        >
          Create Video
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What you can do here</CardTitle>
          <CardDescription>
            The cards are samples so the pages are not empty. They are not your
            real footage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
            <li>
              Choose a photo or video and preview it. Refreshing the page
              clears that preview.
            </li>
            <li>Open the Media Library and filter All, Videos, or Photos.</li>
            <li>Use the search box at the top to filter the sample titles and tags.</li>
            <li>
              On Create Video, write a direction. The storyboard is a plan, not
              a finished video.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
