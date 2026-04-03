-- Lineup visibility foundation:
-- - Ensure contest_entries exists in current schema shape
-- - Keep contests.entry_count in sync when entries change
-- - Allow admins to view all entries; users keep own-entry visibility

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lineup_id uuid references public.lineups (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists contest_entries_contest_idx on public.contest_entries (contest_id);
create index if not exists contest_entries_user_created_idx on public.contest_entries (user_id, created_at desc);

alter table public.contest_entries enable row level security;

drop policy if exists "Users select own contest entries" on public.contest_entries;
create policy "Users select own contest entries"
  on public.contest_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own contest entries" on public.contest_entries;
create policy "Users insert own contest entries"
  on public.contest_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admins select all contest entries" on public.contest_entries;
create policy "Admins select all contest entries"
  on public.contest_entries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

create or replace function public.sync_contest_entry_count(p_contest_id text)
returns void
language plpgsql
security definer
set search_path = public
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
  set entry_count = v_count
  where id = p_contest_id;
end;
$$;

create or replace function public.contest_entries_sync_entry_count_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_contest_entry_count(new.contest_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.sync_contest_entry_count(old.contest_id);
    return old;
  else
    if old.contest_id is distinct from new.contest_id then
      perform public.sync_contest_entry_count(old.contest_id);
    end if;
    perform public.sync_contest_entry_count(new.contest_id);
    return new;
  end if;
end;
$$;

drop trigger if exists contest_entries_sync_entry_count on public.contest_entries;
create trigger contest_entries_sync_entry_count
after insert or update or delete on public.contest_entries
for each row
execute function public.contest_entries_sync_entry_count_trigger();
