-- Profile row per auth user: balances, credits, loyalty (replaces user_wallets).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_balance numeric not null default 0,
  site_credits numeric not null default 0,
  loyalty_points integer not null default 0,
  loyalty_tier text not null default 'Bronze',
  updated_at timestamptz not null default now()
);

create index if not exists profiles_id_idx on public.profiles (id);

comment on table public.profiles is 'User profile: wallet balances, loyalty points, tier. id matches auth.users.id.';

-- Migrate existing wallet data (if user_wallets exists from prior migration).
do $profiles_mig$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_wallets'
  ) and (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name in (
        'id', 'account_balance', 'site_credits', 'loyalty_points', 'loyalty_tier', 'updated_at'
      )
  ) = 6 then
    insert into public.profiles (id, account_balance, site_credits, loyalty_points, loyalty_tier, updated_at)
    select
      w.user_id,
      w.account_balance,
      w.site_credits,
      w.loyalty_points,
      coalesce(nullif(trim(w.tier_status), ''), 'Bronze'),
      w.updated_at
    from public.user_wallets w
    on conflict (id) do update set
      account_balance = excluded.account_balance,
      site_credits = excluded.site_credits,
      loyalty_points = excluded.loyalty_points,
      loyalty_tier = excluded.loyalty_tier,
      updated_at = excluded.updated_at;
  end if;
end $profiles_mig$;

-- Any auth users without a row yet.
do $profiles_fill$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    insert into public.profiles (id)
    select u.id
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
    on conflict (id) do nothing;
  end if;
end $profiles_fill$;

alter table public.profiles enable row level security;

drop policy if exists "Users select own profile" on public.profiles;
create policy "Users select own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Replace wallet trigger with profile trigger.
drop trigger if exists on_auth_user_created_wallet on auth.users;
drop function if exists public.handle_new_user_wallet();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

drop table if exists public.user_wallets cascade;
