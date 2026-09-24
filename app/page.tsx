import { HomeLinks } from "@/components/home-links"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
          can preview a file, save it to the library once Supabase is
          connected, and ask for a storyboard of a social video.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          There are three projects: Ibiza Pole Retreat, Phuket Pole Retreat, and
          Flirty Fitness. Pick one at the top. The library, search, upload, and
          storyboard then use only that project.
        </p>
      </div>

      <HomeLinks />

      <Card>
        <CardHeader>
          <CardTitle>What you can do here</CardTitle>
          <CardDescription>
            Sample cards fill the library until a project has real uploads.
            They are not your footage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6">
            <li>
              Choose a photo or video and preview it. When Supabase is
              connected, Save to library keeps it for the project you picked.
            </li>
            <li>Open the Media Library and filter All, Videos, or Photos.</li>
            <li>
              Use the search box at the top. It only looks inside the project
              you picked.
            </li>
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
