-- Contest catalog for the lobby; `lineups.contest_id` references `contests.id`.

create table if not exists public.contests (
  id text primary key,
  name text not null,
  entry_fee_usd numeric(12, 2) not null check (entry_fee_usd >= 0),
  max_entries integer not null check (max_entries > 0),
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists contests_starts_at_idx on public.contests (starts_at);

comment on table public.contests is 'DFS contest definitions; lineup rows reference id via lineups.contest_id.';

alter table public.contests enable row level security;

drop policy if exists "Anyone can read contests" on public.contests;
create policy "Anyone can read contests"
  on public.contests
  for select
  to anon, authenticated
  using (true);

-- Public entry totals (RLS on lineups would hide other users' rows to anon; definer bypasses for aggregate only).
drop function if exists public.contest_lineup_count(text) cascade;
create or replace function public.contest_lineup_count(p_contest_id text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint from public.lineups l where l.contest_id::text = p_contest_id;
$$;

grant execute on function public.contest_lineup_count(text) to anon, authenticated;

-- Lobby API: contest metadata + live count of submitted lineups per contest.
drop view if exists public.contests_with_stats cascade;
create view public.contests_with_stats as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.starts_at,
  c.created_at,
  public.contest_lineup_count(c.id::text)::integer as current_entries
from public.contests c;

comment on view public.contests_with_stats is 'Contests with current_entries = number of lineups for that contest.';

grant select on public.contests_with_stats to anon, authenticated;

do $seed_contests$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contests'
      and column_name = 'id'
      and data_type = 'text'
  ) then
    insert into public.contests (id, name, entry_fee_usd, max_entries, starts_at) values
      ('birdie-builder', '$5 Birdie Builder', 5, 100, now() + interval '6 hours'),
      ('fairway-challenge', '$25 Fairway Challenge', 25, 250, now() + interval '7 hours'),
      ('sunday-major', '$100 Sunday Major', 100, 300, now() + interval '2 days'),
      ('ace-hole', '$1 Ace in the Hole', 1, 500, now() + interval '5 hours'),
      ('club-pro-special', '$50 Club Pro Special', 50, 280, now() + interval '3 days')
    on conflict (id) do nothing;
  end if;
end $seed_contests$;
