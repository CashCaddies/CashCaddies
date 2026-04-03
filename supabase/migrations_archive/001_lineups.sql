-- Run this in the Supabase SQL Editor (or via CLI) before submitting lineups.

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  golfers jsonb not null,
  total_salary integer not null,
  salary_cap integer not null default 50000,
  created_at timestamptz not null default now()
);

create index if not exists lineups_user_id_created_at_idx
  on public.lineups (user_id, created_at desc);

alter table public.lineups enable row level security;

drop policy if exists "Users insert own lineups" on public.lineups;
create policy "Users insert own lineups"
  on public.lineups
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users select own lineups" on public.lineups;
create policy "Users select own lineups"
  on public.lineups
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
