-- Ensures `insurance_pool` exists for Safety Coverage fund reads (fixes PostgREST 404 when bulk migrations were skipped).
-- Canonical column is `total_balance` (matches 062_insurance_pool_segregated_fund.sql and app code).

create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_balance numeric not null default 0,
  constraint insurance_pool_total_balance_nonneg check (total_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.insurance_pool is
  'Singleton-style fund balance for Safety Coverage; balance changes via insurance engine when fully migrated.';

comment on column public.insurance_pool.total_balance is
  'Running balance of the player-protection pool.';

insert into public.insurance_pool (total_balance)
select 0
where not exists (select 1 from public.insurance_pool limit 1);

alter table public.insurance_pool enable row level security;

drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool
  for select
  to anon, authenticated
  using (true);

grant select on public.insurance_pool to anon, authenticated;
