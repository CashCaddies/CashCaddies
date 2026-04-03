-- Normalized lineups + lineup_players (replaces legacy lineups with jsonb golfers).
-- Run after 001_lineups / 002_golfers. Drops old public.lineups shape.

drop policy if exists "Users insert own lineups" on public.lineups;
drop policy if exists "Users select own lineups" on public.lineups;
drop table if exists public.lineups cascade;

create table if not exists public.lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  total_salary integer not null,
  created_at timestamptz not null default now()
);

create index if not exists lineups_user_created_idx on public.lineups (user_id, created_at desc);
create index if not exists lineups_contest_idx on public.lineups (contest_id);

create table if not exists public.lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  golfer_id uuid not null references public.golfers (id) on delete restrict,
  unique (lineup_id, golfer_id)
);

create index if not exists lineup_players_lineup_idx on public.lineup_players (lineup_id);
create index if not exists lineup_players_golfer_idx on public.lineup_players (golfer_id);

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

alter table public.lineup_players enable row level security;

drop policy if exists "Users select own lineup_players" on public.lineup_players;
create policy "Users select own lineup_players"
  on public.lineup_players
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lineups l
      where l.id = lineup_players.lineup_id
        and l.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users insert own lineup_players" on public.lineup_players;
create policy "Users insert own lineup_players"
  on public.lineup_players
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.lineups l
      where l.id = lineup_players.lineup_id
        and l.user_id = (select auth.uid())
    )
  );
