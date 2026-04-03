-- DFS lock: roster edits and new entries only before contests.starts_at (contest start / lock time).
-- View exposes start_time + lineup_locked. Enforcement via triggers (production-safe).

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
      and now() >= c.starts_at
  );
$$;

comment on function public.contest_is_past_start(text) is
  'True when current time is at or after contests.starts_at for this id.';

grant execute on function public.contest_is_past_start(text) to anon, authenticated;

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
      and now() >= c.starts_at
  );
$$;

comment on function public.lineup_roster_locked(uuid) is
  'True when lineup is tied to a contest that has reached starts_at.';

grant execute on function public.lineup_roster_locked(uuid) to anon, authenticated;

-- contests.start_time: same instant as starts_at (lock time). Add generated column if missing.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contests'
      and column_name = 'start_time'
  ) then
    alter table public.contests
      add column start_time timestamptz generated always as (starts_at) stored;
  end if;
end $$;

comment on column public.contests.start_time is 'DFS contest start / lock time (mirrors starts_at).';

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
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_lineup_count(c.id::text)::integer as current_entries
from public.contests c;

comment on view public.contests_with_stats is
  'Contests with stats; start_time; lineup_locked when now >= starts_at.';

grant select on public.contests_with_stats to anon, authenticated;

drop function if exists public.trg_enforce_contest_entries_lock() cascade;
create or replace function public.trg_enforce_contest_entries_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; entries are closed.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if public.contest_is_past_start(old.contest_id::text) then
      raise exception 'Contest has started; contest entry cannot be modified.';
    end if;
    return new;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_contest_entries_lock on public.contest_entries;
create trigger enforce_contest_entries_lock
before insert or update on public.contest_entries
for each row execute function public.trg_enforce_contest_entries_lock();

drop function if exists public.trg_enforce_lineup_players_lock() cascade;
create or replace function public.trg_enforce_lineup_players_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lid uuid;
begin
  lid := coalesce(new.lineup_id, old.lineup_id);
  if lid is null then
    return coalesce(new, old);
  end if;
  if public.lineup_roster_locked(lid) then
    raise exception 'Contest has started; lineup roster is locked.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists enforce_lineup_players_lock on public.lineup_players;
create trigger enforce_lineup_players_lock
before insert or update or delete on public.lineup_players
for each row execute function public.trg_enforce_lineup_players_lock();

drop function if exists public.trg_enforce_lineups_contest_lock() cascade;
create or replace function public.trg_enforce_lineups_contest_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.contest_id is not null and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot create a lineup for this contest.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.contest_id is not null
       and old.contest_id is distinct from new.contest_id
       and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot assign this contest to the lineup.';
    end if;
    if public.lineup_roster_locked(old.id) then
      if (old.user_id is distinct from new.user_id)
         or (old.contest_id is distinct from new.contest_id)
         or (old.total_salary is distinct from new.total_salary)
         or (old.created_at is distinct from new.created_at)
         or (old.entry_fee is distinct from new.entry_fee)
         or (old.protection_fee is distinct from new.protection_fee)
         or (old.total_paid is distinct from new.total_paid)
         or (old.protection_enabled is distinct from new.protection_enabled)
         or (old.contest_entry_id is distinct from new.contest_entry_id)
      then
        raise exception 'Contest has started; lineup is locked.';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_lineups_contest_lock on public.lineups;
create trigger enforce_lineups_contest_lock
before insert or update on public.lineups
for each row execute function public.trg_enforce_lineups_contest_lock();
