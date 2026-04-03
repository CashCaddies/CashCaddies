-- Contest entry: stored entry_number per (user, contest), unique constraint, atomic create + wallet in one DB function.

-- Repair lock triggers if migration 036 ran without contest_id::text casts (uuid/text drift).
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

alter table public.contest_entries
  add column if not exists entry_number integer;

-- Backfill must bypass lock trigger when contests have already started.
alter table public.contest_entries disable trigger enforce_contest_entries_lock;

-- Backfill: first entry per user+contest = 1, second = 2, ...
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, contest_id
      order by created_at asc, id asc
    ) as en
  from public.contest_entries
)
update public.contest_entries ce
set entry_number = r.en
from ranked r
where ce.id = r.id
  and (ce.entry_number is null or ce.entry_number < 1);

update public.contest_entries
set entry_number = 1
where entry_number is null;

alter table public.contest_entries enable trigger enforce_contest_entries_lock;

alter table public.contest_entries
  alter column entry_number set not null;

alter table public.contest_entries
  alter column entry_number set default 1;

create unique index if not exists contest_entries_user_contest_entry_number_uidx
  on public.contest_entries (user_id, contest_id, entry_number);

comment on column public.contest_entries.entry_number is
  '1-based index of this user''s entries in the contest (leaderboard ordering uses separate logic).';

-- Tier from loyalty points (mirrors app tierFromPoints).
drop function if exists public.loyalty_tier_from_points(integer) cascade;
create or replace function public.loyalty_tier_from_points(p_points integer)
returns text
language sql
immutable
as $$
  select case
    when p_points >= 10000 then 'Platinum'
    when p_points >= 2500 then 'Gold'
    when p_points >= 500 then 'Silver'
    else 'Bronze'
  end;
$$;
