-- Paste this once in the Supabase SQL editor, then click Run.
-- It only adds columns and one small table. It does not delete or rename anything.
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
