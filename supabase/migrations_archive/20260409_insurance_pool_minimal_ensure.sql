-- Ensures insurance_pool exists for PostgREST (fixes 404 when prior migrations never applied).
-- App reads total_balance and/or total_amount in fetchInsurancePoolBalanceUsd.

create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_amount numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.insurance_pool add column if not exists total_balance numeric not null default 0;

-- Mirror legacy balances so app can read either column.
update public.insurance_pool set total_balance = total_amount where total_balance = 0 and coalesce(total_amount, 0) <> 0;
update public.insurance_pool set total_amount = total_balance where total_amount = 0 and coalesce(total_balance, 0) <> 0;
update public.insurance_pool set total_amount = total_balance where total_amount is distinct from total_balance;

insert into public.insurance_pool (total_amount, total_balance)
select 0, 0
where not exists (select 1 from public.insurance_pool limit 1);

alter table public.insurance_pool enable row level security;
drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool for select to anon, authenticated using (true);
grant select on public.insurance_pool to anon, authenticated;
