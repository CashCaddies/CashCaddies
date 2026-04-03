-- Lobby stats: count entries where automatic protection has triggered (replaces insured_golfer_id count).

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
  (
    select count(*)::integer
    from public.contest_entries e
    where e.contest_id = c.id
      and coalesce(e.protection_triggered, false) = true
  ) as protected_entries_count,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on column public.contests_with_stats.protected_entries_count is
  'Entries with automatic protection triggered (protection_triggered).';

comment on view public.contests_with_stats is
  'Lobby catalog + entry-derived stats; protected_entries_count = triggered automatic protection.';

alter view public.contests_with_stats owner to postgres;

grant select on table public.contests_with_stats to anon, authenticated;
