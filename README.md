# Retreat Content Library

This is a small website for Suzanne’s pole-retreat photos and videos.

You can browse sample cards, preview a file on your own computer, and build a storyboard for a social video. This version does not save anything, and it does not make a finished video.

You do not need an account for this step.

## What is real vs sample

The pages are real. You can click through them in the browser.

The Media Library cards are fake samples so the page is not empty. The titles are made up, such as “Sample: People laughing”. Each card uses a simple poster drawn for this project. There is no photo or video file behind those cards.

There are two made-up camps. Phuket Pole Camp 2026 is the current one. Bali Pole Retreat 2025 is a past one.

The Upload page can preview a photo or video you choose. That preview is temporary. Refresh the page and it is gone. The file is not uploaded anywhere, and it is not added to the Media Library.

Create Video builds a storyboard from the words you type. It matches those words to sample titles, tags, and places. It does not watch the footage. It does not render or export a video.

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
- `/upload` lets you preview a photo or video in the browser.
- `/library` shows the sample cards. Use All, Videos, or Photos.
- `/create-video` turns a written direction into a storyboard.
- The search box sits at the top of every page. It filters the sample cards by title, tag, retreat, and place.

Main files:

- `app/page.tsx` — home
- `app/upload/page.tsx` — preview a photo or video
- `app/library/page.tsx` — sample cards
- `app/create-video/page.tsx` — the storyboard
- `app/layout.tsx` — the top bar and search
- `lib/sample-media.ts` — the fake list
- `lib/find-moments.ts` — picks a sample for each line of a direction
- `components/search-box.tsx`, `components/media-card.tsx`, and `components/upload-form.tsx`

## What still needs accounts

Supabase can save real photos and videos later. That needs a Supabase account.

Twelve Labs can look inside the real footage later. That needs a Twelve Labs account. The only file to change for that is `lib/find-moments.ts`. Replace `findMoments` with the Twelve Labs call. The storyboard page can stay.

Rendering a finished video comes after real media and that AI are connected. Export is on the page, but it does nothing yet. This app is meant to assemble the video itself later. CapCut and VN are not part of this.

There is still no login.

## ASSUMPTIONS

- The app uses the Next.js App Router, TypeScript, Tailwind, and shadcn/ui. Buttons, text fields, and cards come from shadcn. Those files live in `components/ui`.
- The sample cards are posters only. I did not download any photo or video, so nothing copyrighted is included.
- Photos and videos live in one list, `lib/sample-media.ts`. Each item has a title, a type, a retreat name and year, a place, and a few tags.
- The library tabs show All, Videos, or Photos. Search still works on top of the tab you picked.
- Search compares your words with the title, tags, retreat name, year, and place. It ignores capital letters. It does not look inside a file.
- The search text stays while you move between pages. Refreshing clears the search, same as the upload preview.
- Choosing a file on Upload does not add it to the Media Library.
- Create Video splits the direction on the word “then”. Each piece becomes one scene of 5 seconds. Moving or removing a scene updates the times.
- If a line is about announcing the camp, or about a background, that scene also shows the title text, camp date, and camp location you typed.
- `lib/find-moments.ts` is a clearly labelled placeholder. It only does keyword and tag matching. It is the module a Twelve Labs call will replace later.
- There is no login, no database, no real AI call, and no video renderer.
- The dev server allows `127.0.0.1` as well as `localhost`, so the pages stay interactive at either address.
