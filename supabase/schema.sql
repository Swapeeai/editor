-- Paste this once in the Supabase SQL editor, then run it.
-- Create the private Storage bucket named "media" in the Storage screen.
-- This file does not create the bucket.
--
-- There is no login yet. The Next.js API uses the service role key,
-- which bypasses these rules. The anon key used in the browser cannot
-- read or write this table. The private bucket stays private.

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (project_id in ('ibiza', 'phuket', 'flati')),
  title text not null,
  media_type text not null check (media_type in ('video', 'photo')),
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists media_items_project_created_idx
  on public.media_items (project_id, created_at desc);

alter table public.media_items enable row level security;

revoke all on table public.media_items from anon, authenticated;
