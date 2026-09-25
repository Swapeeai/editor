import { HomeLinks } from "@/components/home-links"

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Retreat Content Library
        </h1>
        <p className="text-base leading-7 text-muted-foreground">
          Pick a project, import videos from Google Photos or Google Drive,
          then export a vertical video. The three projects are Ibiza Pole
          Retreat, Phuket Pole Retreat, and Flirty Fitness.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          Clips are matched by file title. Twelve Labs is not connected, so
          the app does not watch the footage. Each file can be 50 MB. The free
          plan holds about 1 GB in total.
        </p>
      </div>
      <HomeLinks />
    </div>
  )
}
