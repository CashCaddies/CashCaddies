-- Deposits: create_deposit records pending ledger only (no balance credit).
-- complete_deposit(reference) finalizes after Stripe confirmation (webhook); only path that credits account_balance.

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

  if v_ref is null then
    return jsonb_build_object('ok', false, 'error', 'reference_required');
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
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
    'pending',
    v_ref
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.complete_deposit(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ref text;
  v_id uuid;
  v_user_id uuid;
  v_amount numeric;
  v_status text;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_ref := nullif(trim(coalesce(p_reference, '')), '');
  if v_ref is null then
    return jsonb_build_object('ok', false, 'error', 'missing_reference');
  end if;

  select wt.id, wt.user_id, wt.amount, wt.status
  into v_id, v_user_id, v_amount, v_status
  from public.wallet_transactions wt
  where wt.reference_id = v_ref
    and wt.type = 'deposit'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_status = 'completed' then
    return jsonb_build_object('ok', true, 'message', 'already_completed');
  end if;

  if v_status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  perform 1 from public.profiles p where p.id = v_user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + v_amount, 2),
    updated_at = now()
  where p.id = v_user_id;

  update public.wallet_transactions wt
  set status = 'completed'
  where wt.id = v_id;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.create_deposit(uuid, numeric, text) is
  'Insert pending deposit row (reference required). Does not credit account_balance.';

comment on function public.complete_deposit(text) is
  'Service role: finalize pending deposit by provider reference and credit profiles.account_balance. Idempotent if already completed.';

grant execute on function public.complete_deposit(text) to service_role;
