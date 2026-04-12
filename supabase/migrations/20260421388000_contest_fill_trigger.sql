-- When a contest reaches capacity, set status to 'full'. Requires 'full' in contests.status CHECK.
-- sync_contest_entry_count: also mirror count into current_entries so updates run (baseline only set entry_count).

alter table public.contests
  drop constraint if exists contests_status_lifecycle_check;

alter table public.contests
  add constraint contests_status_lifecycle_check
  check (
    status = any (
      array['filling', 'full', 'locked', 'live', 'complete', 'settled', 'cancelled']::text[]
    )
  );

comment on column public.contests.status is
  'Contest lifecycle: filling, full (at capacity), locked, live, complete, settled, cancelled.';

create or replace function public.sync_contest_entry_count(p_contest_id text)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_count integer := 0;
begin
  if p_contest_id is null or btrim(p_contest_id) = '' then
    return;
  end if;

  select count(*)::integer
  into v_count
  from public.contest_entries ce
  where ce.contest_id = p_contest_id;

  update public.contests
  set
    entry_count = v_count,
    current_entries = v_count
  where id = p_contest_id;
end;
$$;

create or replace function public.handle_contest_fill()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.current_entries >= new.max_entries then
    new.status := 'full';
  end if;

  return new;
end;
$$;

comment on function public.handle_contest_fill() is
  'Before update on contests: if current_entries >= max_entries, set status to full.';

drop trigger if exists trg_contest_fill on public.contests;

create trigger trg_contest_fill
before update on public.contests
for each row
execute function public.handle_contest_fill();
