-- Impression events (views) per founder update — funnel top for views → clicks → signups.

create table public.update_impressions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  update_id uuid not null references public.founder_updates (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  session_id text
);

create index update_impressions_update_id_idx on public.update_impressions (update_id);

comment on table public.update_impressions is 'Raw impression events; deduping not applied yet.';

alter table public.update_impressions enable row level security;

create policy "insert impressions anon"
  on public.update_impressions
  for insert
  to anon
  with check (user_id is null);

create policy "insert impressions authenticated"
  on public.update_impressions
  for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

grant insert on table public.update_impressions to anon, authenticated;

create or replace view public.update_impression_counts as
select
  update_id,
  count(*)::bigint as impression_count
from public.update_impressions
group by update_id;

comment on view public.update_impression_counts is 'Grouped impression counts per founder update (admin metrics).';
