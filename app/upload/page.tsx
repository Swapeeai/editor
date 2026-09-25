import { DriveImport } from "@/components/drive-import"
import { PhotosImport } from "@/components/photos-import"
import { UploadForm } from "@/components/upload-form"
import { isSupabaseConfigured } from "@/lib/supabase-admin"
import { formatUploadLimit } from "@/lib/upload-limit"

export const metadata = {
  title: "Upload · Retreat Content Library",
}

export default function UploadPage() {
  const connected = isSupabaseConfigured()

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Upload</h1>
        <p className="text-base leading-7 text-muted-foreground">
          {connected
            ? `Choose many files or drop a folder. They all save to the project under Saving to. Each file can be ${formatUploadLimit()}. If Supabase refuses a file, raise the global file size limit in Storage settings. Use http://localhost:43123.`
            : "Supabase is not connected, so nothing is saved yet."}
        </p>
      </div>
      <UploadForm connected={connected} />
      <PhotosImport connected={connected} />
      <DriveImport connected={connected} />
    </div>
  )
}
