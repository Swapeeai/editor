import { LibraryGrid } from "@/components/library-grid"

export const metadata = {
  title: "Media Library · Retreat Content Library",
}

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Media Library</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          You only see the project picked at the top. Saved files for that
          project show up here when Supabase is connected. If it is not
          connected, or this project has no uploads yet, the page shows sample
          cards with a Sample label.
        </p>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Use All, Videos, or Photos, and the search box at the top, to narrow
          the list.
        </p>
      </div>
      <LibraryGrid />
    </div>
  )
}
