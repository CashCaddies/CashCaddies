-- Stability: insurance_pool for PostgREST (404) + contest_entries columns + user_id -> profiles FK (embeds / 400 fixes).

-- ---------------------------------------------------------------------------
-- insurance_pool (idempotent; matches app + legacy readers)
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.insurance_pool add column if not exists total_balance numeric not null default 0;

update public.insurance_pool
set total_balance = total_amount
where total_balance = 0 and coalesce(total_amount, 0) <> 0;

update public.insurance_pool
set total_amount = total_balance
where total_amount = 0 and coalesce(total_balance, 0) <> 0;

update public.insurance_pool
set total_amount = total_balance
where total_amount is distinct from total_balance;

insert into public.insurance_pool (total_amount, total_balance)
select 0, 0
where not exists (select 1 from public.insurance_pool limit 1);

alter table public.insurance_pool enable row level security;
drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool for select to anon, authenticated using (true);
grant select on public.insurance_pool to anon, authenticated;

-- ---------------------------------------------------------------------------
-- contest_entries: required columns (additive only) + FK for PostgREST embeds
-- ---------------------------------------------------------------------------
alter table public.contest_entries add column if not exists entry_fee numeric not null default 0;
alter table public.contest_entries add column if not exists lineup_id uuid;
alter table public.contest_entries add column if not exists created_at timestamptz not null default now();

-- Ensure every entry user has a profile row before swapping FK (profiles.id = auth.users.id).
insert into public.profiles (id)
select distinct ce.user_id
from public.contest_entries ce
where exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'contest_entries'
  )
  and not exists (select 1 from public.profiles p where p.id = ce.user_id)
on conflict (id) do nothing;

-- PostgREST embed `profiles(...)` from `contest_entries` requires FK user_id -> public.profiles(id).
do $$
declare
  r record;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'contest_entries'
  ) then
    return;
  end if;

  for r in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_schema = kcu.constraint_schema
     and tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
     and tc.table_name = kcu.table_name
    where tc.table_schema = 'public'
      and tc.table_name = 'contest_entries'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
  loop
    execute format('alter table public.contest_entries drop constraint %I', r.constraint_name);
  end loop;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'contest_entries'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'contest_entries_user_id_fkey_profiles'
      and conrelid = 'public.contest_entries'::regclass
  ) then
    alter table public.contest_entries
      add constraint contest_entries_user_id_fkey_profiles
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
  when others then null;
end $$;
