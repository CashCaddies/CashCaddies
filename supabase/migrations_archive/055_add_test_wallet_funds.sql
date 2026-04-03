-- Dev-only wallet top-up: logs a positive transaction (type test_credit) and bumps profiles.account_balance in one transaction.
-- Enable/disable flag: migration 056 — public.app_config key allow_test_wallet_funding (value 'true'), not ALTER DATABASE.

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check check (
    type in (
      'entry',
      'credit',
      'refund',
      'protection_purchase',
      'contest_prize',
      'contest_insurance_payout',
      'test_credit'
    )
  );

comment on constraint transactions_type_check on public.transactions is
  'Includes test_credit for development wallet top-ups (see add_test_funds).';

create or replace function public.add_test_funds(p_user_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_bal numeric;
begin
  if coalesce(current_setting('app.allow_test_wallet_funding', true), '') <> 'on' then
    raise exception
      'Test wallet funding is disabled. Enable with: ALTER DATABASE (your db name) SET app.allow_test_wallet_funding = ''on''; (see migration 055_add_test_wallet_funds.sql).'
      using errcode = 'P0001';
  end if;

  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'You can only add test funds to your own account.'
      using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if p_amount > 10000 then
    raise exception 'Amount exceeds maximum for test funding.'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = p_user_id
  returning p.account_balance into v_new_bal;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    p_amount,
    'test_credit',
    format('Development test wallet credit ($%s)', p_amount::text)
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_bal
  );
end;
$$;

comment on function public.add_test_funds(uuid, numeric) is
  'Dev-only: credits account_balance and inserts test_credit (see 056 app_config allow flag).';

revoke all on function public.add_test_funds(uuid, numeric) from public;
grant execute on function public.add_test_funds(uuid, numeric) to authenticated;
