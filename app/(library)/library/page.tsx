import { LibraryGrid } from "@/components/library-grid"

export const metadata = {
  title: "Media Library · Retreat Content Library",
}

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <LibraryGrid />
    </div>
  )
}
