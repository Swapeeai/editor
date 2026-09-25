# Retreat Content Library

A private library for three projects: Ibiza Pole Retreat, Phuket Pole Retreat, and Flirty Fitness. There is no login.

Pick a project, import videos from Google Photos or Google Drive (or upload a file), then Create Video and Export a vertical MP4. With a Twelve Labs key, each phrase in the direction is found as a moment inside your footage. Without the key, clips are matched by title and file name, and the library says “AI search not connected yet”.

## Run on your own computer

Install Node.js LTS first, from [https://nodejs.org](https://nodejs.org). On Windows, use the LTS installer and click Next. Open a new terminal afterwards.

Install Git as well, from [https://git-scm.com/download/win](https://git-scm.com/download/win). Click through the installer. If PowerShell says `git` is not recognised, the install is missing or the terminal was opened before it finished. Close the terminal, open a new one, and try `git` again.

In this folder:

```bash
npm install
copy .env.example .env.local
npm run dev
```

On Mac or Linux, the copy command is `cp .env.example .env.local`.

`npm install` is required. It downloads the video tool (`ffmpeg-static`) that Export uses.

Open `.env.local` and paste your Supabase and Google values. Never commit `.env.local`. If you already have that file, keep it when you replace this folder.

Then open [http://localhost:43123](http://localhost:43123). Use that address. Google sign-in only allows `http://localhost:43123`, not `127.0.0.1`.

If you change `.env.local`, stop the app and run `npm run dev` again.

## Updates

Stop the app with Ctrl+C. In this folder, the update is:

```powershell
git pull
npm run dev
```

Run `npm install` again only when `git pull` changes `package.json`. Do not delete `.env.local`.

`update-app.ps1` is a backup for a download link. Day to day, use `git pull`.

## What you do

1. Pick a project at the top.
2. On Upload, click **Choose videos**. Hold Ctrl (or Shift) to select many, then **Save**. The batch saves to the project under **Saving to**. Files over the upload limit are skipped. A failed file does not stop the rest. The limit is `NEXT_PUBLIC_MAX_UPLOAD_MB` in `.env.local` (5000, meaning 5 GB, when that line is missing). It must not be higher than the Supabase global file size limit. You can also import from Google Photos or Google Drive.
3. Open Media Library to see what was saved.
4. On Create Video, type a direction with the word “then” between moments. Build the storyboard. Set **Start at second** if you want a different in-point. Choose **Export**, then download `retreat-video.mp4`.

## AI search (Twelve Labs)

Do this once, after the app is already running with Supabase:

1. In the Supabase SQL editor, open `supabase/schema-twelvelabs.sql`, paste the whole file, and click Run. Do not run `supabase/schema.sql` again.
2. In `.env.local`, add a line `TWELVE_LABS_API_KEY=` and paste the key from the Twelve Labs dashboard (API Keys). No quotes. This name is server-only. Do not put it in a `NEXT_PUBLIC_` name, and do not commit `.env.local`.
3. Stop the app and run `npm run dev` again.

Until that key is set, nothing calls Twelve Labs. Create Video still matches titles, and the library says “AI search not connected yet”.

After the key is set, a new video is sent for indexing when it is saved. For videos already in the library, open Media Library and click **Prepare existing videos for AI search**. Each video shows **Indexing…**, then **Ready for AI search**. Indexing often takes about 30–40% of the video’s length. The free plan includes 600 minutes in total (it does not come back if you delete a video), 5 videos indexing at once, and indexes are kept for 90 days.

`npm install` is not required for this update. The app calls Twelve Labs with `fetch`.

Google Drive setup clicks are in `docs/google-drive-setup.md`. Leave `NEXT_PUBLIC_GOOGLE_API_KEY` empty. If the file window says the developer key is invalid, enable **Google Picker API** in Google Cloud (APIs & Services → Library). You can also paste a Drive file link on the Upload page.

Pasted links are refused unless you set `NEXT_PUBLIC_GOOGLE_DRIVE_READONLY=yes` and add the scope `https://www.googleapis.com/auth/drive.readonly` on the Google consent screen. That screen then asks to see the files in your Drive, not only files you pick. The app stays in Testing. Click Advanced, then Go to Retreat Content Library (unsafe). Restart the app and sign in again.

## Google Photos

Retreat videos that live in Google Photos use **Import from Google Photos**. It uses the same Client ID already in `.env.local`. No new key. Open the app at [http://localhost:43123](http://localhost:43123).

Do these clicks once in [Google Cloud](https://console.cloud.google.com):

1. **APIs & Services → Library**. Search `Photos Picker API`. Click **Enable**.
2. **Google Auth platform → Data Access → Add or remove scopes**. Add `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. Click **Update**, then **Save**.
3. In the app, click **Import from Google Photos** and sign in again. On the “not verified” screen, click **Advanced**, then **Go to Retreat Content Library (unsafe)**.

A video that Google Photos is still processing is skipped. Each file must be within the upload limit (5 GB unless you set `NEXT_PUBLIC_MAX_UPLOAD_MB` lower).

## Export limits

- The file is vertical, 1080×1920, for Instagram or TikTok.
- When a moment was found, Export cuts that moment’s start and end, up to 30 seconds. Otherwise each video scene is 5 seconds from the start second you set. Photos become a 3 second still.
- There is no sound.
- A plain title card is added at the start with the title, date, and place. The letters are simple capitals.
- Each source file must be within the upload limit (5 GB unless `NEXT_PUBLIC_MAX_UPLOAD_MB` is set lower). That number must not exceed the Supabase project's global file size limit.
- If the finished MP4 is over the upload limit, you can still download it. It is not saved in the library.

## Supabase, once

The table is already created if you ran `supabase/schema.sql`. The private bucket must be named `media` (lowercase). The three Supabase names in `.env.local` are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not put the service role key in chat or in a `NEXT_PUBLIC_` name.

Stored project ids stay `ibiza`, `phuket`, and `flati`. Do not rerun the SQL to rename them.
