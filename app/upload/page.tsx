import { DriveImport } from "@/components/drive-import"
import { UploadForm } from "@/components/upload-form"
import { isSupabaseConfigured } from "@/lib/supabase-admin"

export const metadata = {
  title: "Upload · Retreat Content Library",
}

export default function UploadPage() {
  const connected = isSupabaseConfigured()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Upload</h1>
        <p className="text-base leading-7 text-muted-foreground">
          Choose a photo or a video. You will see its name. A video also gets a
          player if this browser can play it.
        </p>
        <p className="text-base leading-7 text-muted-foreground">
          {connected
            ? "The file belongs to the project selected at the top. After the preview looks right, choose Save to library. Each file must be 50 MB or smaller. The free Supabase plan holds about 1 GB in total."
            : "Supabase is not connected, so this page can only preview a file. Nothing is saved. Each file must be 50 MB or smaller. The free Supabase plan holds about 1 GB in total."}
        </p>
      </div>
      <DriveImport connected={connected} />
      <UploadForm connected={connected} />
    </div>
  )
}
