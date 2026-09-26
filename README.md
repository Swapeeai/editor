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

Open Settings in the app and paste your Supabase, Google, and Twelve Labs values. They are written to `.env.local` on this computer. Never commit `.env.local`. If you already have that file, keep it when you replace this folder.

Settings has no login. The page and its save route work only while you run the app on your own computer (`npm run dev` at localhost). They are turned off in a production build, and they refuse any other host. Do not put this app on the public internet.

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
2. On Upload, click **Choose videos**. Hold Ctrl (or Shift) to select many, then **Save**. iPhone HEIC photos are turned into JPEG automatically. The batch saves to the project under **Saving to**. Files over the upload limit are skipped. A failed file does not stop the rest. The limit is `NEXT_PUBLIC_MAX_UPLOAD_MB` in `.env.local` (5000, meaning 5 GB, when that line is missing). It must not be higher than the Supabase global file size limit. You can also import from Google Photos or Google Drive.

iPhone photos use `heic-convert`. That package includes libheif as JavaScript, so Windows does not need another install. This update changes `package.json`, so run `npm install` once after you update.
3. Open Media Library to see what was saved. The list is paged, 24 at a time. Each video card shows a still picture, not a player, so a few hundred clips stay quick to scroll. Click the picture to play. If the stills are missing, click **Generate missing thumbnails**. Click a title to rename it. Enter saves. Tab saves and moves to the next title. If that name is already used, the app adds a number (`beach 1`, `beach 2`) and leaves other clips alone. Tick the checkboxes, then **Add to folder**, **Add keyword**, **Delete selected**, or **Rename with pattern** (`beach` becomes beach 1, beach 2, and so on). On a video, **Cut** saves a real new clip of the range you choose. You can save several parts from one video. Each part keeps the keywords and folders, and sits next to the video it came from, with a **Part of** badge. **Cut parts** shows only those. After a save, **Show in library** jumps to that part. **Delete the original** asks you to confirm and tells you how many parts will stay. Deleting the original does not delete those parts. A short part uses fewer of the 600 indexing minutes than the whole video, so cut before you prepare a video for AI search. Photos have no Cut button. If an iPhone photo was already saved as HEIC, click **Convert iPhone photos to JPEG**. It converts only those photos in the project you have open. Other files stay as they are. On a video, **Review moments** asks Twelve Labs for the strongest parts. Keep, trim, or reject each one, or keep the whole video, then save. Create Video uses those saved moments first. If the library says **Database update needed**, click **Copy SQL**, paste it in the Supabase SQL editor, and click Run.
4. Folders belong to the project you have open. Examples: Adam, Jenny, Phuket, Boat trip, Party. A clip can be in more than one. **All** and **Unsorted** are always there. Create, rename, or delete a folder. Deleting a folder does not delete the clips.
5. Open **Review** to work through clips one at a time. The player starts muted, and the next clip is loaded behind it. Edit the title and keywords, tick folders, then **Save** (or Enter). **Skip** (or the right arrow) leaves it unreviewed. **D** deletes after you confirm. The line **37 of 269 reviewed** is how many are done. **Needs review** is the ones you have not saved yet, so you can leave and come back.
6. On Create Video, write the brief in sections. A section starts with a time, such as `0–3 sec — Paradise` or `00:00–00:03`. The lines under it are what to look for. A line that starts with `Text:` is burned onto that scene. A line `Folder: Boat trip` searches only that folder. Style and closing notes are shown as “not a scene” and are left out of the video. You can still write `then` between moments, or put one scene on each line. Build the storyboard. If AI search is not connected, or nothing matches closely, the scene says so and Export will not guess a clip. Choose **Export**, then download `retreat-video.mp4`. The picture is 1080×1920. There is no sound and no music.

## AI search (Twelve Labs)

Do this once, after the app is already running with Supabase:

1. In the Supabase SQL editor, open `supabase/schema-update.sql`, paste the whole file, and click Run. That one file adds Twelve Labs columns, keywords, folders, the reviewed flag, video length, approved moments, the indexing-minute log, which video a cut came from, and thumbnail paths. It is safe if you already ran the earlier Twelve Labs SQL. Do not run `supabase/schema.sql` again. The library also has a **Copy SQL** button for this file.
2. In `.env.local`, add a line `TWELVE_LABS_API_KEY=` and paste the key from the Twelve Labs dashboard (API Keys). No quotes. This name is server-only. Do not put it in a `NEXT_PUBLIC_` name, and do not commit `.env.local`.
3. Stop the app and run `npm run dev` again.

Until that key is set, nothing calls Twelve Labs. Create Video still matches titles, and the library says “AI search not connected yet”.

A new upload is not sent for indexing on its own. In Media Library, tick the videos you want, then **Prepare selected videos for AI search**. The app reads each length, shows about how many minutes that is, how many of the 600 are already used (an estimate), and asks you to confirm. It will not send a video whose length it cannot read, and it will not send a selection that would go past 600. Five videos index at once. **Continue** starts the next waiting ones. **Stop waiting videos** clears the ones not sent yet. Videos already sent finish. The free plan includes 600 minutes in total (it does not come back if you delete a video), and indexes are kept for 90 days. The header figure is an estimate, because Twelve Labs does not show a lifetime total.

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
- Each scene keeps the length written in the brief. A long section can use more than one clip. Photos become a 3 second still when the brief does not set a shorter time.
- There is no sound and no music.
- A plain title card is added at the start with the title, date, and place. The letters are simple capitals.
- Each source file must be within the upload limit (5 GB unless `NEXT_PUBLIC_MAX_UPLOAD_MB` is set lower). That number must not exceed the Supabase project's global file size limit.
- If the finished MP4 is over the upload limit, you can still download it. It is not saved in the library.

## Supabase, once

The table is already created if you ran `supabase/schema.sql`. The private bucket must be named `media` (lowercase). The three Supabase names in `.env.local` are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not put the service role key in chat or in a `NEXT_PUBLIC_` name.

Stored project ids stay `ibiza`, `phuket`, and `flati`. Do not rerun the SQL to rename them.
