-- Serialize capacity checks per contest: lock contests row before counting entries so
-- concurrent inserts cannot both pass when only one slot remains.

drop function if exists public.trg_enforce_contest_entry_capacity() cascade;
create or replace function public.trg_enforce_contest_entry_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer;
  per_user integer;
  n_total bigint;
  n_user bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- Row lock: all inserts for this contest queue here; count reflects committed rows only.
  select c.max_entries, c.max_entries_per_user
  into cap, per_user
  from public.contests c
  where c.id::text = new.contest_id::text
  for update;

  if not found then
    raise exception 'Contest not found.'
      using errcode = 'P0001';
  end if;

  cap := greatest(1, coalesce(cap, 1));

  select count(*)::bigint
  into n_total
  from public.contest_entries ce
  where ce.contest_id::text = new.contest_id::text;

  if n_total >= cap then
    raise exception 'This contest is full.'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint
  into n_user
  from public.contest_entries ce
  where ce.contest_id::text = new.contest_id::text
    and ce.user_id = new.user_id;

  if n_user >= coalesce(per_user, 999999) then
    raise exception 'Max entries per user for this contest.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.trg_enforce_contest_entry_capacity() is
  'Before insert: lock contest row, reject when count(contest_entries) >= max_entries (same transaction as insert).';
