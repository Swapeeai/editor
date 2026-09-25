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
          Type what you want, using the word “then” between moments. When AI
          search is connected, each phrase is found inside your footage. You can
          still change the start second and the scene order, then Export a
          vertical MP4.
        </p>
      </div>
      <CreateVideoForm />
    </div>
  )
}
