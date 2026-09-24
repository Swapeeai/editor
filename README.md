# Retreat Content Library

This is a small website for Suzanne’s pole-retreat videos.

You can open three pages, preview a video file on your own computer, and search sample titles. This version does not save anything.

Photos are not in this version. It is videos only.

## What is real vs sample

The pages are real. You can click through them in the browser.

The Media Library cards are fake samples so the page is not empty. The titles are made up, such as “Sample: People laughing”. Each card uses a simple poster image drawn for this project. There is no video file behind those cards.

The Upload page can preview a video you choose. That preview is temporary. Refresh the page and it is gone. The file is not uploaded anywhere, and it is not added to the Media Library.

You do not need an account for this step.

## How to run it locally

Install the packages, then start the app:

```bash
npm install
npm run dev
```

Open [http://localhost:43123](http://localhost:43123). [http://127.0.0.1:43123](http://127.0.0.1:43123) works too.

`npm run dev` starts Next.js on port **43123**. It listens on all network interfaces so you can open it from another device on the same network.

## Pages

- `/` is the home page, titled Retreat Content Library.
- `/upload` lets you choose a video and preview it in the browser.
- `/library` shows the sample video cards.
- The search box sits at the top of every page. It filters the sample cards by title.

Main files:

- `app/page.tsx` — home
- `app/upload/page.tsx` — preview a video
- `app/library/page.tsx` — sample cards
- `app/layout.tsx` — the top bar and search
- `lib/sample-videos.ts` — the fake list
- `components/search-box.tsx`, `components/video-card.tsx`, and `components/upload-form.tsx`

## What comes later

A later version can use Supabase to save videos. It can use Twelve Labs to find moments inside videos, for example “people laughing”, “students clapping”, “Adam teaching”, “group hugging”, and “dynamic pole trick”. A video editor can come after that.

None of that is in this version.

## ASSUMPTIONS

- The app uses the Next.js App Router, TypeScript, Tailwind, and shadcn/ui. Buttons, inputs, and cards come from shadcn. Those files live in `components/ui`.
- The sample cards are posters only. I did not download any video, so nothing copyrighted is included.
- Search compares the words you type with the sample titles. It ignores capital letters. It does not look inside a video frame.
- The search text is kept in the page while you move between Home, Upload, and Media Library. Refreshing the page clears the search, same as the upload preview.
- Choosing a file on the Upload page does not add it to the Media Library. The library only shows the five sample cards.
- Photos are out of this slice. The home page says that in one sentence.
- There is no login, no database, no Twelve Labs client, and no video editor.
- The dev server allows `127.0.0.1` as well as `localhost`, so the pages stay interactive at either address.
