# Retreat Content Library

This is a small website for Suzanne’s photos and videos.

It holds three projects: Ibiza Pole Retreat, Phuket Pole Retreat, and Flirty Fitness. You pick one at the top. The library, search, upload, and storyboard then use only that project. The addresses still use `ibiza`, `phuket`, and `flati`.

You can preview a file, save it to a private Supabase bucket, browse what you saved, and build a storyboard. If Supabase is not set up, or a project has no uploads yet, the library shows sample cards instead.

You do not need an account to use the site. There is no login screen.

## What is real vs sample

The pages are real. You can click through them in the browser.

Sample cards are fake, so the library is not empty before you upload. The titles are made up, such as “Sample: People laughing”. Each sample card uses a simple poster drawn for this project. A sample card is labelled **Sample**.

Each sample belongs to one project. Ibiza and Phuket are pole-retreat samples. Flirty Fitness is general fitness and studio samples.

When the three Supabase values are set, **Save to library** stores the file in a private bucket named `media` and adds a row for the active project. The Media Library then shows those saved files instead of the samples. Photos and videos are opened with a short-lived link. The bucket stays private.

Create Video builds a storyboard from the words you type. It uses saved files for the active project when there are any. Saved files have no tags yet, so it matches the title and the file name. If there are no saved files, it uses the sample cards. It does not watch the footage. It does not render or export a video.

## Run on your own computer

Use this in a terminal on your own computer, in the project folder. You do not need Cursor’s preview.

Install Node.js LTS first, from [https://nodejs.org](https://nodejs.org). On Windows, download the LTS installer and click Next through it. Close the installer, then open a new terminal so `npm` is available.

Then run:

```bash
npm install
cp .env.example .env.local
```

On Windows, the copy command is:

```bash
copy .env.example .env.local
```

Open `.env.local` and paste your three Supabase values into the empty lines. The names are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not put those values in the README, in chat, or in any file that starts with `NEXT_PUBLIC_` except the anon key, which already has that name.

Never commit `.env.local`. Git is already set to ignore it.

Start the app:

```bash
npm run dev
```

That command uses port **43123**. Open the URL the terminal prints. It is usually [http://localhost:43123](http://localhost:43123). [http://127.0.0.1:43123](http://127.0.0.1:43123) works too.

If you change `.env.local` later, stop the app and run `npm run dev` again. Next.js only reads that file when it starts.

## Pages

- `/` is the home page, titled Retreat Content Library.
- `/upload` previews a photo or video, then can save it to the active project.
- `/library` lists saved files for the project you picked, or sample cards if there are none. Use All, Videos, or Photos.
- `/create-video` turns a written direction into a storyboard for that same project.
- `POST /api/upload` saves one file. `GET /api/media?project=ibiza` lists saved files (`phuket` and `flati` work the same way).
- The project switcher and the search box sit at the top of every page.

The chosen project is stored in the address as `?project=ibiza`, `?project=phuket`, or `?project=flati`. It is also remembered in the browser, so a refresh keeps it. The first visit opens Ibiza Pole Retreat.

Main files:

- `app/page.tsx` — home
- `app/upload/page.tsx` — preview, then save
- `app/library/page.tsx` — saved files, or samples
- `app/create-video/page.tsx` — the storyboard
- `app/api/upload/route.ts` — saves a file with the service role key
- `app/api/media/route.ts` — lists saved files for one project
- `app/layout.tsx` — the top bar, project switcher, and search
- `lib/projects.ts` — the three project names
- `lib/sample-media.ts` — the fake list
- `lib/find-moments.ts` — picks a clip for each line of a direction
- `lib/supabase-admin.ts` — the server-only Supabase client
- `supabase/schema.sql` — the table to paste once
- `components/search-box.tsx`, `components/media-card.tsx`, and `components/upload-form.tsx`

## Connect Supabase

Do these steps once. Until they are done, Upload says Supabase is not connected, and the library keeps showing samples.

1. In the Supabase dashboard, open **Storage**. Create a bucket named `media`. Leave it **private**. Do not make it public.
2. Open the **SQL Editor**. Paste the whole file `supabase/schema.sql`. Run it once.
3. On your computer, copy `.env.example` to a new file named `.env.local` in this project folder.
4. In Supabase, open **Project Settings → API**. Copy the three values into `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon public key)
   - `SUPABASE_SERVICE_ROLE_KEY` (the service_role secret)
5. Restart the app. Stop it, then run `npm run dev` again. Next.js only reads `.env.local` at startup.

Never paste the service_role key into chat. Never put it in a name that starts with `NEXT_PUBLIC_`. That prefix is sent to the browser. The service role key must stay in `.env.local` only. `.env.local` is not committed.

There is no login yet. **Save to library** asks this website for a short-lived upload link (`POST /api/upload`). Your browser then sends the file straight to the private `media` bucket. `POST /api/upload/complete` adds the row in `media_items`. The service role key stays on the server and is not sent to the browser. The anon key cannot read the table. The bucket stays private.

Each file can be up to **50 MB**. All files together can be about **1 GB** on the free Supabase plan. A bigger file shows an error on the Upload page and is not saved. Playback links expire after one hour. Refresh the Media Library to get a new link.

A saved file is stored at:

`media/{project_id}/{uuid}-{safeFileName}`

`media` is the bucket. `project_id` is `ibiza`, `phuket`, or `flati`. The file name is cleaned so it is safe to store.

## What still needs accounts

Twelve Labs can look inside the real footage later. That needs a Twelve Labs account. The only file to change for that is `lib/find-moments.ts`. Replace `findMoments` with the Twelve Labs call. The storyboard page can stay. It should still receive only the active project’s media.

Rendering a finished video comes after real media and that AI are connected. Export is on the page, but it does nothing yet. This app is meant to assemble the video itself later. CapCut and VN are not part of this.

There is still no login.

## ASSUMPTIONS

- The app uses the Next.js App Router, TypeScript, Tailwind, and shadcn/ui. Buttons, text fields, and cards come from shadcn. Those files live in `components/ui`.
- The sample cards are posters only. I did not download any photo or video, so nothing copyrighted is included.
- There are three projects. Every sample item has one `projectId`: `ibiza`, `phuket`, or `flati`. Saved rows use the same three ids.
- The display names are Ibiza Pole Retreat, Phuket Pole Retreat, and Flirty Fitness. The stored ids stay `ibiza`, `phuket`, and `flati`, so existing uploads and the table check still match. Do not rerun the SQL for a rename.
- The project switcher is in the top bar. Switching clears the search so you see that project’s own cards.
- The choice is saved in the page address (`?project=`) and in the browser. A refresh keeps it. If the address has no project, the app uses the last one, or Ibiza Pole Retreat.
- A saved file goes from the browser straight to Storage. The Next.js server only creates the upload link and the library row. The free plan allows 50 MB per file and about 1 GB in total.
- Search, the library, and Create Video only look at the active project.
- Search compares your words with the title, tags, retreat name, year, place, and file name. It ignores capital letters. It does not look inside a file.
- The search text stays while you move between pages. Refreshing clears the search. Switching project also clears it. The local preview clears on refresh. A saved file does not.
- If any of the three Supabase values is missing, saving is off. Upload explains that in plain language. The library shows samples labelled Sample.
- If Supabase is connected but the active project has no rows, the library still shows those samples.
- If the active project has saved rows, the library shows only those rows. Sample cards are hidden for that project.
- Saved files have no tags column yet. Create Video matches their title and file name. `lib/find-moments.ts` is still the placeholder a Twelve Labs call will replace.
- The service role key is read only in `lib/supabase-admin.ts`, which the browser cannot import. Uploads go through the API route so the private bucket stays private until login exists.
- There is no login screen, no Twelve Labs call, and no video renderer.
- The dev server allows `127.0.0.1` as well as `localhost`, so the pages stay interactive at either address.
