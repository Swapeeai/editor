-- Keywords and approved moments. Safe to run more than once.
-- Prefer supabase/schema-update.sql if you have not run the Twelve Labs SQL yet.
-- That file includes this one. Do not run supabase/schema.sql again.

alter table public.media_items
  add column if not exists keywords text;

create table if not exists public.approved_segments (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  project_id text not null check (project_id in ('ibiza', 'phuket', 'flati')),
  start_seconds double precision not null,
  end_seconds double precision,
  label text,
  created_at timestamptz not null default now(),
  check (start_seconds >= 0),
  check (end_seconds is null or end_seconds > start_seconds)
);

create index if not exists approved_segments_media_idx
  on public.approved_segments (media_item_id, start_seconds);

alter table public.approved_segments enable row level security;

revoke all on table public.approved_segments from anon, authenticated;
