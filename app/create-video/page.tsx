import { CreateVideoForm } from "@/components/create-video-form"

export const metadata = {
  title: "Create Video · Retreat Content Library",
}

export default function CreateVideoPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Create Video</h1>
        <p className="text-base leading-7 text-muted-foreground">
          Describe the video in plain language. The page builds a storyboard:
          an ordered list of scenes, with a time range and a photo or video
          for each line.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          Saved files for the project you picked are used when they exist.
          Those files have no tags yet, so matching uses the title and file
          name. If there are no saved files, the sample cards are used instead.
          It does not pull clips from the other projects. It does not watch the
          footage, and it does not make a finished video. The matching lives in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            lib/find-moments.ts
          </code>
          . That file is the placeholder to swap for Twelve Labs later.
        </p>
      </div>
      <CreateVideoForm />
    </div>
  )
}
