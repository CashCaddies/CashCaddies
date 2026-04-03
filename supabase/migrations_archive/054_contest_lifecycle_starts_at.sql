-- Authoritative schedule: contests.starts_at = lock / go-live; optional contests.ends_at = completed.
-- One-time data fix: move all contest starts to the future; clear lineup locks that referenced past starts.

comment on column public.contests.starts_at is
  'Authoritative contest start (lock) time; entry and roster edits allowed only while now() < starts_at.';

alter table public.contests
  add column if not exists ends_at timestamptz;

comment on column public.contests.ends_at is
  'When set, contest is completed after this instant. When null, app treats "ended" as starts_at + 3 days (scoring window).';

-- Stagger starts so the lobby still orders sensibly; ends align with settlement-style window (3 days after start).
with ordered as (
  select id, row_number() over (order by id) as rn
  from public.contests
)
update public.contests c
set
  starts_at = now() + interval '7 days' + ((o.rn - 1) * interval '1 hour'),
  ends_at = now() + interval '7 days' + ((o.rn - 1) * interval '1 hour') + interval '3 days'
from ordered o
where c.id = o.id;

-- Lineups that were locked against an old schedule; clear lock when contest is again in the future.
update public.lineups l
set locked_at = null
from public.contests c
where c.id::text = l.contest_id::text
  and l.locked_at is not null
  and now() < c.starts_at;

-- Lock / entry rules use starts_at only (start_time is generated from starts_at when present).
create or replace function public.contest_is_past_start(p_contest_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.contests c
    where c.id::text = p_contest_id
      and now() >= c.starts_at
  );
$$;

comment on function public.contest_is_past_start(text) is
  'True when now() >= contests.starts_at (authoritative start time).';

grant execute on function public.contest_is_past_start(text) to anon, authenticated;

drop view if exists public.contests_with_stats cascade;
create view public.contests_with_stats as
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
  'Lobby: starts_at, optional ends_at; lineup_locked when now >= starts_at (entry closes only at start, not at end).';

grant select on public.contests_with_stats to anon, authenticated;

-- Empty catalog: insert one future contest (id type matches column: uuid or text).
insert into public.contests (id, name, entry_fee_usd, max_entries, max_entries_per_user, starts_at, ends_at)
select
  gen_random_uuid(),
  'Open Table',
  5,
  500,
  10,
  now() + interval '7 days',
  now() + interval '10 days'
where not exists (select 1 from public.contests limit 1);
