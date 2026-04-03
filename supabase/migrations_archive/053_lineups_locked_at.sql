-- Persist lineup lock time on lineups.locked_at; materialize at/after contest start; block roster edits once locked.

alter table public.lineups
  add column if not exists locked_at timestamptz;

comment on column public.lineups.locked_at is
  'Set to contests.starts_at when the contest has started; roster and lineup row metadata cannot change after this (total_score may still update).';

-- Backfill for contests already past start (idempotent).
update public.lineups l
set locked_at = c.starts_at
from public.contests c
where l.contest_id is not null
  and c.id::text = l.contest_id::text
  and l.locked_at is null
  and now() >= c.starts_at;

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
    where l.id = p_lineup_id
      and (
        l.locked_at is not null
        or (
          l.contest_id is not null
          and exists (
            select 1
            from public.contests c
            where c.id::text = l.contest_id::text
              and now() >= c.starts_at
          )
        )
      )
  );
$$;

comment on function public.lineup_roster_locked(uuid) is
  'True when lineups.locked_at is set or the lineup contest has reached starts_at.';

create or replace function public.trg_enforce_lineups_contest_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid text;
  v_starts timestamptz;
  v_started boolean;
begin
  if tg_op = 'INSERT' then
    new.locked_at := null;
    if new.contest_id is not null and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot create a lineup for this contest.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    v_cid := coalesce(new.contest_id, old.contest_id)::text;
    v_started := v_cid is not null and public.contest_is_past_start(v_cid);

    if new.contest_id is not null
       and old.contest_id is distinct from new.contest_id
       and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot assign this contest to the lineup.';
    end if;

    select c.starts_at into v_starts
    from public.contests c
    where c.id::text = v_cid
    limit 1;

    if old.locked_at is not null then
      new.locked_at := old.locked_at;
    elsif v_started and v_starts is not null then
      new.locked_at := v_starts;
    else
      new.locked_at := null;
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
