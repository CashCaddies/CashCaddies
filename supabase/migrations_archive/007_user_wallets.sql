-- One wallet row per auth user: balances, credits, loyalty, tier.
-- If creating a trigger on auth.users fails in your environment, drop the trigger block
-- and rely on the backfill + client insert (see use-wallet hook).

create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  account_balance numeric not null default 0,
  site_credits numeric not null default 0,
  loyalty_points integer not null default 0,
  tier_status text not null default 'Bronze',
  updated_at timestamptz not null default now()
);

create index if not exists user_wallets_user_id_idx on public.user_wallets (user_id);

comment on table public.user_wallets is 'User wallet: cash balance, site credits, loyalty points, VIP tier.';

alter table public.user_wallets enable row level security;

drop policy if exists "Users select own wallet" on public.user_wallets;
create policy "Users select own wallet"
  on public.user_wallets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own wallet" on public.user_wallets;
create policy "Users insert own wallet"
  on public.user_wallets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- New signups get a wallet row (requires permission on auth.users in hosted Supabase).
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_wallet on auth.users;
create trigger on_auth_user_created_wallet
  after insert on auth.users
  for each row execute function public.handle_new_user_wallet();

-- Existing users before trigger existed
insert into public.user_wallets (user_id)
select u.id
from auth.users u
where not exists (select 1 from public.user_wallets w where w.user_id = u.id);
