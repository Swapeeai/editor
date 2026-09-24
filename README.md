# Retreat Content Library

This is a small website for Suzanne’s photos and videos.

It holds three projects: Ibiza Pro Retreat, Phuket Pro Retreat, and Flati Fitness. You pick one at the top. The library, search, upload note, and storyboard then use only that project.

You can browse sample cards, preview a file on your own computer, and build a storyboard. This version does not save anything, and it does not make a finished video.

You do not need an account for this step.

## What is real vs sample

The pages are real. You can click through them in the browser.

The Media Library cards are fake samples so the page is not empty. The titles are made up, such as “Sample: People laughing”. Each card uses a simple poster drawn for this project. There is no photo or video file behind those cards.

Each sample belongs to one project. Ibiza and Phuket are pole-retreat samples. Flati Fitness is general fitness and studio samples.

The Upload page can preview a photo or video you choose. That preview is temporary. Refresh the page and it is gone. The file is not uploaded anywhere, and it is not added to the Media Library. The page names the project the file will belong to once saving exists.

Create Video builds a storyboard from the words you type. It matches those words to sample titles, tags, and places in the active project only. It does not watch the footage. It does not render or export a video.

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
- `/library` shows the sample cards for the project you picked. Use All, Videos, or Photos.
- `/create-video` turns a written direction into a storyboard for that same project.
- The project switcher and the search box sit at the top of every page.

The chosen project is stored in the address as `?project=ibiza`, `?project=phuket`, or `?project=flati`. It is also remembered in the browser, so a refresh keeps it. The first visit opens Ibiza Pro Retreat.

Main files:

- `app/page.tsx` — home
- `app/upload/page.tsx` — preview a photo or video
- `app/library/page.tsx` — sample cards
- `app/create-video/page.tsx` — the storyboard
- `app/layout.tsx` — the top bar, project switcher, and search
- `lib/projects.ts` — the three project names
- `lib/sample-media.ts` — the fake list
- `lib/find-moments.ts` — picks a sample for each line of a direction
- `lib/supabase.ts` — reads the Supabase names, and does nothing until they are set
- `components/search-box.tsx`, `components/media-card.tsx`, and `components/upload-form.tsx`

## Supabase later

Saving files will use Supabase. You do not need it yet. When you create a Supabase project, copy two values into a file named `.env.local` on your computer. That file is not committed.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The same empty names are in `.env.example`. Do not put real keys in the repository. Leave them blank until you have them.

`lib/supabase.ts` reads those two names. If either one is missing, it returns nothing and the Upload page says saving is not configured. This version does not call Supabase, and it does not create a bucket.

## What still needs accounts

Supabase can save real photos and videos later. That needs a Supabase project and the two values above.

Twelve Labs can look inside the real footage later. That needs a Twelve Labs account. The only file to change for that is `lib/find-moments.ts`. Replace `findMoments` with the Twelve Labs call. The storyboard page can stay. It should still receive only the active project’s media.

Rendering a finished video comes after real media and that AI are connected. Export is on the page, but it does nothing yet. This app is meant to assemble the video itself later. CapCut and VN are not part of this.

There is still no login.

## ASSUMPTIONS

- The app uses the Next.js App Router, TypeScript, Tailwind, and shadcn/ui. Buttons, text fields, and cards come from shadcn. Those files live in `components/ui`.
- The sample cards are posters only. I did not download any photo or video, so nothing copyrighted is included.
- There are three projects. Every sample item has one `projectId`: `ibiza`, `phuket`, or `flati`.
- Ibiza Pro Retreat and Phuket Pro Retreat are pole retreats. Flati Fitness is a studio and fitness sample set.
- The project switcher is in the top bar. Switching clears the search so you see that project’s own cards.
- The choice is saved in the page address (`?project=`) and in the browser. A refresh keeps it. If the address has no project, the app uses the last one, or Ibiza Pro Retreat.
- Search, the library, and Create Video only look at the active project.
- Search compares your words with the title, tags, retreat name, year, and place. It ignores capital letters. It does not look inside a file.
- The search text stays while you move between pages. Refreshing clears the search. Switching project also clears it. The upload preview clears on refresh.
- Choosing a file on Upload does not add it to the Media Library. The page says which project it will belong to.
- Create Video splits the direction on the word “then”. Each piece becomes one scene of 5 seconds. Moving or removing a scene updates the times. Changing project starts the form over so the storyboard cannot keep another project’s clips.
- If a line is about announcing the camp, or about a background, that scene also shows the title text, camp date, and camp location you typed.
- `lib/find-moments.ts` is a clearly labelled placeholder. It only does keyword and tag matching. It is the module a Twelve Labs call will replace later.
- `lib/supabase.ts` does not talk to Supabase. There are no fake keys in the repo.
- There is no login, no database call, no real AI call, and no video renderer.
- The dev server allows `127.0.0.1` as well as `localhost`, so the pages stay interactive at either address.
