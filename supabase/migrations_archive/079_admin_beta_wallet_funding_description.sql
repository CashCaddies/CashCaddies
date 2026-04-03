-- Align admin beta wallet funding ledger copy.

create or replace function public.admin_add_beta_funds(p_amount numeric default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_account_balance numeric;
  v_wallet_balance numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.'
      using errcode = 'P0001';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.admin_user is true
  ) then
    raise exception 'Only admin users can add beta funds.'
      using errcode = '42501';
  end if;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = v_uid
  returning p.account_balance, p.wallet_balance into v_new_account_balance, v_wallet_balance;

  insert into public.transactions (user_id, amount, type, description)
  values (
    v_uid,
    p_amount,
    'beta_credit',
    'Beta wallet funding'
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_account_balance,
    'wallet_balance', v_wallet_balance
  );
end;
$$;
