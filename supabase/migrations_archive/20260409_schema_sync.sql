-- Schema sync when remote DB skipped migrations: ensures core tables exist for PostgREST (404) + valid columns (400).
-- contests.id is text (013_contests.sql); contest_entries.contest_id matches that, not uuid.

-- ---------------------------------------------------------------------------
-- profiles (required for wallet, RLS, contest_entries admin policy)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_balance numeric not null default 0,
  site_credits numeric not null default 0,
  loyalty_points integer not null default 0,
  loyalty_tier text not null default 'Bronze',
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists beta_status text default 'pending';
alter table public.profiles add column if not exists beta_user boolean not null default false;
alter table public.profiles add column if not exists founding_tester boolean not null default false;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists wallet_balance numeric;
alter table public.profiles add column if not exists protection_credit_balance numeric not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- insurance_pool
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.insurance_pool add column if not exists total_balance numeric not null default 0;
alter table public.insurance_pool add column if not exists created_at timestamptz not null default now();

insert into public.insurance_pool (total_amount)
select 0
where not exists (select 1 from public.insurance_pool);

update public.insurance_pool
set total_balance = coalesce(total_balance, total_amount, 0),
    total_amount = coalesce(total_amount, total_balance, 0)
where total_balance is distinct from total_amount;

alter table public.insurance_pool enable row level security;
drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool for select to anon, authenticated using (true);
grant select on public.insurance_pool to anon, authenticated;

-- ---------------------------------------------------------------------------
-- contest_entries (contest_id text = public.contests.id)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  lineup_id uuid,
  entry_fee numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.contest_entries add column if not exists entry_number integer;
alter table public.contest_entries add column if not exists protection_fee numeric not null default 0;
alter table public.contest_entries add column if not exists total_paid numeric not null default 0;
alter table public.contest_entries add column if not exists protection_enabled boolean not null default false;
alter table public.contest_entries add column if not exists protection_triggered boolean not null default false;
alter table public.contest_entries add column if not exists protected_golfer_id uuid;
alter table public.contest_entries add column if not exists protection_token_issued boolean not null default false;

create index if not exists contest_entries_user_created_idx
  on public.contest_entries (user_id, created_at desc);
create index if not exists contest_entries_contest_idx
  on public.contest_entries (contest_id);

alter table public.contest_entries enable row level security;
drop policy if exists "Users select own contest entries" on public.contest_entries;
create policy "Users select own contest entries"
  on public.contest_entries for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users insert own contest entries" on public.contest_entries;
create policy "Users insert own contest entries"
  on public.contest_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
grant select, insert on public.contest_entries to authenticated;

drop policy if exists "Admins select all contest entries" on public.contest_entries;
create policy "Admins select all contest entries"
  on public.contest_entries for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- user_notifications (app uses kind, title, body, read_at; optional legacy cols)
-- ---------------------------------------------------------------------------
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'protection',
  title text not null default '',
  body text not null default '',
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.user_notifications add column if not exists message text;
alter table public.user_notifications add column if not exists read boolean default false;
alter table public.user_notifications add column if not exists email_sent_at timestamptz;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;
drop policy if exists "Users select own notifications" on public.user_notifications;
create policy "Users select own notifications"
  on public.user_notifications for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
  on public.user_notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, update on public.user_notifications to authenticated;
