-- Deposits / withdrawals: one implicit transaction per RPC (COMMIT only after function returns).
-- Row lock on profiles prevents concurrent withdrawals racing past balance checks.
-- Balance UPDATE is inlined so ledger insert + balance change are visibly one unit.

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
  v_rounded numeric;
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

  v_rounded := round(p_amount, 2);
  v_ref := nullif(trim(coalesce(p_reference, '')), '');

  <<deposit_atomic>>
  begin
    perform 1 from public.profiles p where p.id = p_user_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'profile_not_found');
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
      'deposit',
      v_rounded,
      'completed',
      v_ref
    );

    update public.profiles p
    set
      account_balance = round(coalesce(p.account_balance, 0)::numeric + v_rounded, 2),
      updated_at = now()
    where p.id = p_user_id;
  end deposit_atomic;

  return jsonb_build_object('ok', true);
end;
$$;

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

  <<withdrawal_atomic>>
  begin
    select coalesce(p.account_balance, 0)::numeric into v_balance
    from public.profiles p
    where p.id = p_user_id
    for update;

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

    update public.profiles p
    set
      account_balance = round(coalesce(p.account_balance, 0)::numeric - v_amt, 2),
      updated_at = now()
    where p.id = p_user_id;
  end withdrawal_atomic;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.create_deposit(uuid, numeric, text) is
  'Atomically insert wallet_transactions row and credit profiles.account_balance (single txn).';

comment on function public.create_withdrawal(uuid, numeric, text) is
  'Lock profile row, check balance, atomically insert ledger (negative amount) and debit account_balance.';

-- Superseded by inlined updates above (single transaction with ledger + balance).
drop function if exists public.update_user_balance(uuid, numeric);
