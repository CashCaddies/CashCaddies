-- Ledger for wallet activity (entries, credits, refunds, protection).

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  type text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint transactions_type_check check (
    type in ('entry', 'credit', 'refund', 'protection_purchase')
  )
);

do $idx$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'user_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'created_at'
  ) then
    execute 'create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions' and column_name = 'type'
  ) then
    execute 'create index if not exists transactions_type_idx on public.transactions (type)';
  end if;
end $idx$;

comment on table public.transactions is 'Negative amount = debit; positive = credit in/refund.';
comment on column public.transactions.amount is 'Signed: negative for charges, positive for credits and refunds.';

alter table public.transactions enable row level security;

drop policy if exists "Users select own transactions" on public.transactions;
create policy "Users select own transactions"
  on public.transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
