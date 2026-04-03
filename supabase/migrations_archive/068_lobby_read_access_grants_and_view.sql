-- Lobby: PostgREST/anon must read contests catalog + stats view. Security-invoker views still require
-- SELECT on base tables; grants were missing on public.contests (and golfers). Recreate the lobby view
-- with security_invoker = false so only the view grant is required for API reads (owner reads contests;
-- contest_entry_count remains SECURITY DEFINER for entry totals).

grant select on table public.contests to anon, authenticated;
grant select on table public.golfers to anon, authenticated;
grant select on table public.contest_payouts to anon, authenticated;

drop policy if exists "Anyone can read contests" on public.contests;
create policy "Anyone can read contests"
  on public.contests
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read contest_payouts" on public.contest_payouts;
create policy "Anyone can read contest_payouts"
  on public.contest_payouts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read golfers" on public.golfers;
create policy "Anyone can read golfers"
  on public.golfers
  for select
  to anon, authenticated
  using (true);

-- Recreate lobby view: access underlying contests as view owner (bypasses invoker needing table grant).
drop view if exists public.contests_with_stats cascade;

create view public.contests_with_stats
  with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.start_time,
  c.ends_at,
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_entry_count(c.id::text)::integer as current_entries,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on view public.contests_with_stats is
  'Lobby catalog + entry-derived stats; security_invoker=false so anon can select the view without direct contests table grant.';

alter view public.contests_with_stats owner to postgres;

grant select on table public.contests_with_stats to anon, authenticated;
