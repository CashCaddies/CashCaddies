-- Wallet ledger: deposits, withdrawals, and future gateway references (e.g. Stripe).
-- Spendable balance remains `profiles.account_balance` (existing app wallet + CHECK non‑negative).

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  amount numeric not null,
  status text not null default 'completed',
  reference_id text,
  created_at timestamptz not null default now(),
  constraint wallet_transactions_type_check check (
    type = any (
      array[
        'deposit'::text,
        'withdrawal'::text,
        'contest_entry'::text,
        'winnings'::text
      ]
    )
  ),
  constraint wallet_transactions_status_check check (
    status = any (array['pending'::text, 'completed'::text, 'failed'::text])
  ),
  constraint wallet_transactions_amount_nonzero check (amount <> 0)
);

comment on table public.wallet_transactions is
  'Audit trail for wallet movements; signed amount (withdrawals stored negative).';

comment on column public.wallet_transactions.reference_id is
  'External id (Stripe payment/transfer, contest_id, etc.).';

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

create index if not exists wallet_transactions_reference_idx
  on public.wallet_transactions (reference_id)
  where reference_id is not null;

alter table public.wallet_transactions enable row level security;

drop policy if exists "Users select own wallet_transactions" on public.wallet_transactions;
create policy "Users select own wallet_transactions"
  on public.wallet_transactions for select to authenticated
  using (user_id = auth.uid());

grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;

-- Internal: delta on profiles.account_balance (2dp). Not granted to API clients.
drop function if exists public.update_user_balance(uuid, numeric);

create or replace function public.update_user_balance(p_user_id uuid, p_amount numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_user_id is null then
    raise exception 'update_user_balance: missing user id';
  end if;

  update public.profiles
  set
    account_balance = round(coalesce(account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'update_user_balance: profile not found';
  end if;
end;
$$;

revoke all on function public.update_user_balance(uuid, numeric) from public;

drop function if exists public.create_deposit(uuid, numeric, text);

create or replace function public.create_deposit(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ref text;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  v_ref := nullif(trim(coalesce(p_reference, '')), '');

  insert into public.wallet_transactions (
    user_id,
    type,
    amount,
    status,
    reference_id
  )
  values (
    p_user_id,
    'deposit',
    round(p_amount, 2),
    'completed',
    v_ref
  );

  perform public.update_user_balance(p_user_id, round(p_amount, 2));

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.create_withdrawal(uuid, numeric, text);

create or replace function public.create_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_balance numeric;
  v_ref text;
  v_amt numeric;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_amount');
  end if;

  v_amt := round(p_amount, 2);
  v_ref := nullif(trim(coalesce(p_reference, '')), '');

  select coalesce(p.account_balance, 0)::numeric into v_balance
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if v_balance < v_amt then
    return jsonb_build_object(
      'ok', false,
      'error', 'insufficient_funds'
    );
  end if;

  insert into public.wallet_transactions (
    user_id,
    type,
    amount,
    status,
    reference_id
  )
  values (
    p_user_id,
    'withdrawal',
    -v_amt,
    'completed',
    v_ref
  );

  perform public.update_user_balance(p_user_id, -v_amt);

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.update_user_balance(uuid, numeric) is
  'Apply signed delta to profiles.account_balance (2dp). Internal use.';

comment on function public.create_deposit(uuid, numeric, text) is
  'Insert completed deposit ledger row and credit account_balance. Service role or self.';

comment on function public.create_withdrawal(uuid, numeric, text) is
  'Insert completed withdrawal (negative amount) and debit account_balance if sufficient.';

grant execute on function public.create_deposit(uuid, numeric, text) to service_role;
grant execute on function public.create_deposit(uuid, numeric, text) to authenticated;

grant execute on function public.create_withdrawal(uuid, numeric, text) to service_role;
grant execute on function public.create_withdrawal(uuid, numeric, text) to authenticated;
