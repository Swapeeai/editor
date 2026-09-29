import { HomeLinks } from "@/components/home-links"
import { ProjectCards } from "@/components/project-cards"

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Retreat Content Library
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Three separate libraries. Open one to see what is saved there.
        </p>
      </div>
      <ProjectCards />
      <HomeLinks />
    </div>
  )
}
