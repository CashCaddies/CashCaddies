-- Stability: additive columns + ensure core tables exist (idempotent).
-- insurance_pool: app reads total_balance; total_amount mirrors for compatibility.

create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_balance numeric not null default 0,
  constraint insurance_pool_total_balance_nonneg check (total_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insurance_pool add column if not exists total_amount numeric not null default 0;

update public.insurance_pool
set total_amount = total_balance
where total_amount is distinct from total_balance;

insert into public.insurance_pool (total_balance, total_amount)
select 0, 0
where not exists (select 1 from public.insurance_pool limit 1);

alter table public.insurance_pool enable row level security;
drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool for select to anon, authenticated using (true);
grant select on public.insurance_pool to anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_balance numeric not null default 0,
  site_credits numeric not null default 0,
  loyalty_points integer not null default 0,
  loyalty_tier text not null default 'Bronze',
  updated_at timestamptz not null default now()
);

-- profiles: columns needed for select("*") / middleware / wallet
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists beta_status text default 'pending';
alter table public.profiles add column if not exists beta_user boolean not null default false;
alter table public.profiles add column if not exists founding_tester boolean not null default false;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists wallet_balance numeric;
alter table public.profiles add column if not exists protection_credit_balance numeric not null default 0;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  lineup_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists contest_entries_user_created_idx
  on public.contest_entries (user_id, created_at desc);

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

alter table public.user_notifications add column if not exists email_sent_at timestamptz;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

-- RLS: read/update own rows (idempotent with existing migrations)
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
