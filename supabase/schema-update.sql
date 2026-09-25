-- Paste this once in the Supabase SQL editor, then click Run.
-- It adds the Twelve Labs columns, keywords, folders, reviewed flag, approved moments, video length, index usage, and which video a cut came from.
-- It does not delete or rename anything. Safe to run if some of it already exists.
-- Do not run supabase/schema.sql again.

alter table public.media_items
  add column if not exists twelvelabs_video_id text;

alter table public.media_items
  add column if not exists twelvelabs_asset_id text;

alter table public.media_items
  add column if not exists index_status text;

alter table public.media_items
  add column if not exists index_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_items_index_status_check'
  ) then
    alter table public.media_items
      add constraint media_items_index_status_check
      check (
        index_status is null
        or index_status in ('pending', 'indexing', 'ready', 'failed')
      );
  end if;
end $$;

create table if not exists public.twelvelabs_indexes (
  project_id text primary key check (project_id in ('ibiza', 'phuket', 'flati')),
  index_id text not null,
  created_at timestamptz not null default now()
);

alter table public.twelvelabs_indexes enable row level security;

revoke all on table public.twelvelabs_indexes from anon, authenticated;

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

alter table public.media_items
  add column if not exists duration_seconds double precision;

alter table public.media_items
  add column if not exists reviewed_at timestamptz;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (project_id in ('ibiza', 'phuket', 'flati')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists public.folder_items (
  folder_id uuid not null references public.folders (id) on delete cascade,
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  primary key (folder_id, media_item_id)
);

create index if not exists folder_items_media_idx
  on public.folder_items (media_item_id);

alter table public.folders enable row level security;
alter table public.folder_items enable row level security;

revoke all on table public.folders from anon, authenticated;
revoke all on table public.folder_items from anon, authenticated;

create table if not exists public.index_usage (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid references public.media_items (id) on delete set null,
  project_id text not null check (project_id in ('ibiza', 'phuket', 'flati')),
  duration_seconds double precision not null check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists index_usage_created_idx
  on public.index_usage (created_at);

alter table public.index_usage enable row level security;

revoke all on table public.index_usage from anon, authenticated;

alter table public.media_items
  add column if not exists source_media_id uuid;

alter table public.media_items
  add column if not exists source_title text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'media_items_source_media_id_fkey'
  ) then
    alter table public.media_items
      add constraint media_items_source_media_id_fkey
      foreign key (source_media_id) references public.media_items (id) on delete set null;
  end if;
end $$;

create index if not exists media_items_source_idx
  on public.media_items (source_media_id);
