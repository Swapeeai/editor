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
          These cards are sample placeholders, not your retreat footage. Each
          one shows a poster image. There is no video file behind them in this
          version.
        </p>
      </div>
      <LibraryGrid />
    </div>
  )
}
