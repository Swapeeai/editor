import { ReviewPass } from "@/components/review-pass"

export const metadata = {
  title: "Review · Retreat Content Library",
}

export default function ReviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <ReviewPass />
    </div>
  )
}
