import { UploadForm } from "@/components/upload-form"

export const metadata = {
  title: "Upload · Retreat Content Library",
}

export default function UploadPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Upload</h1>
        <p className="text-base leading-7 text-muted-foreground">
          Choose a photo or a video. You will see its name. A video also gets a
          player if this browser can play it.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          The preview is temporary. Refresh the page and it is gone. The file
          is not added to the Media Library.
        </p>
      </div>
      <UploadForm />
    </div>
  )
}
