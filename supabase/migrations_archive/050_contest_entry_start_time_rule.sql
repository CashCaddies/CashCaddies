-- Late-entry rule: no new or modified contest_entries after contests.start_time (mirrors starts_at).
-- Used by trg_enforce_contest_entries_lock (before insert/update on contest_entries).

drop function if exists public.contest_is_past_start(text) cascade;
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
      and now() >= coalesce(c.start_time, c.starts_at)
  );
$$;

comment on function public.contest_is_past_start(text) is
  'True when now() >= contests.start_time (same instant as starts_at); entries must not be created after this.';

drop function if exists public.lineup_roster_locked(uuid) cascade;
create or replace function public.lineup_roster_locked(p_lineup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lineups l
    inner join public.contests c on c.id::text = l.contest_id::text
    where l.id = p_lineup_id
      and l.contest_id is not null
      and now() >= coalesce(c.start_time, c.starts_at)
  );
$$;
