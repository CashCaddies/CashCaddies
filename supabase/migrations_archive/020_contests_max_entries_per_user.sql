-- Per-user entry cap for contests (enforced in app / future RLS as needed).

alter table public.contests
  add column if not exists max_entries_per_user integer
  check (max_entries_per_user is null or max_entries_per_user > 0);

comment on column public.contests.max_entries_per_user is
  'Max lineup entries per user for this contest.';

update public.contests
set max_entries_per_user = 1
where name ilike '%Single%';

update public.contests
set max_entries_per_user = 3
where name ilike '%3%';

update public.contests
set max_entries_per_user = 1
where max_entries_per_user is null;

-- Expose in lobby view
drop view if exists public.contests_with_stats cascade;
create view public.contests_with_stats as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.created_at,
  public.contest_lineup_count(c.id::text)::integer as current_entries
from public.contests c;

comment on view public.contests_with_stats is 'Contests with current_entries = number of lineups for that contest.';

grant select on public.contests_with_stats to anon, authenticated;
