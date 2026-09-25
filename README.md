# Retreat Content Library

A private library for three projects: Ibiza Pole Retreat, Phuket Pole Retreat, and Flirty Fitness. There is no login.

Pick a project, import videos from Google Photos or Google Drive (or upload a file), then Create Video and Export a vertical MP4. Clips are matched by title and file name. The app does not watch the footage. Twelve Labs is not connected.

## Run on your own computer

Install Node.js LTS first, from [https://nodejs.org](https://nodejs.org). On Windows, use the LTS installer and click Next. Open a new terminal afterwards.

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

## What you do

1. Pick a project at the top.
2. On Upload, choose **Import from Google Photos** or **Import from Google Drive**, or pick a file and **Save to library**.
3. Open Media Library to see what was saved.
4. On Create Video, type a direction with the word “then” between moments. Build the storyboard. Set **Start at second** on a long clip. Choose **Export**, then download `retreat-video.mp4`.

Google Drive setup clicks are in `docs/google-drive-setup.md`. Leave `NEXT_PUBLIC_GOOGLE_API_KEY` empty. If the file window says the developer key is invalid, enable **Google Picker API** in Google Cloud (APIs & Services → Library). You can also paste a Drive file link on the Upload page.

Pasted links are refused unless you set `NEXT_PUBLIC_GOOGLE_DRIVE_READONLY=yes` and add the scope `https://www.googleapis.com/auth/drive.readonly` on the Google consent screen. That screen then asks to see the files in your Drive, not only files you pick. The app stays in Testing. Click Advanced, then Go to Retreat Content Library (unsafe). Restart the app and sign in again.

## Google Photos

Retreat videos that live in Google Photos use **Import from Google Photos**. It uses the same Client ID already in `.env.local`. No new key. Open the app at [http://localhost:43123](http://localhost:43123).

Do these clicks once in [Google Cloud](https://console.cloud.google.com):

1. **APIs & Services → Library**. Search `Photos Picker API`. Click **Enable**.
2. **Google Auth platform → Data Access → Add or remove scopes**. Add `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. Click **Update**, then **Save**.
3. In the app, click **Import from Google Photos** and sign in again. On the “not verified” screen, click **Advanced**, then **Go to Retreat Content Library (unsafe)**.

A video that Google Photos is still processing is skipped. Each file must be 50 MB or smaller.

## Export limits

- The file is vertical, 1080×1920, for Instagram or TikTok.
- Each video scene is 5 seconds, starting at the second you type. A longer clip is cut. Photos become a 3 second still.
- There is no sound.
- A plain title card is added at the start with the title, date, and place. The letters are simple capitals.
- Each source file must be 50 MB or smaller. The free Supabase plan holds about 1 GB in total.
- If the finished MP4 is over 50 MB, you can still download it. It is not saved in the library.

## Supabase, once

The table is already created if you ran `supabase/schema.sql`. The private bucket must be named `media` (lowercase). The three Supabase names in `.env.local` are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not put the service role key in chat or in a `NEXT_PUBLIC_` name.

Stored project ids stay `ibiza`, `phuket`, and `flati`. Do not rerun the SQL to rename them.
