-- Referral reward when a referred user completes a deposit: credit referrer + wallet_transactions row.

alter table public.wallet_transactions
  add column if not exists metadata jsonb;

comment on column public.wallet_transactions.metadata is
  'Optional JSON (e.g. referral_bonus: referred_user, deposit_reference).';

alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check check (
    type = any (
      array[
        'deposit'::text,
        'withdrawal'::text,
        'contest_entry'::text,
        'winnings'::text,
        'referral_bonus'::text
      ]
    )
  );

create or replace function public.complete_deposit(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_ref text;
  v_id uuid;
  v_user_id uuid;
  v_amount numeric;
  v_status text;
  v_referrer uuid;
  v_bonus numeric := 5;
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

  -- Serialize balance changes per user (financial safety).
  perform 1
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  update public.profiles
  set
    account_balance = round(coalesce(account_balance, 0)::numeric + v_amount, 2),
    updated_at = now()
  where id = v_user_id;

  update public.wallet_transactions wt
  set status = 'completed'
  where wt.id = v_id;

  select p.referred_by into v_referrer
  from public.profiles p
  where p.id = v_user_id;

  if v_referrer is not null then
    perform 1
    from public.profiles
    where id = v_referrer
    for update;

    if found then
      perform public.update_user_balance(v_referrer, v_bonus);

      insert into public.wallet_transactions (
        user_id,
        type,
        amount,
        status,
        reference_id,
        metadata
      )
      values (
        v_referrer,
        'referral_bonus',
        v_bonus,
        'completed',
        null,
        jsonb_build_object(
          'referred_user', v_user_id,
          'deposit_reference', v_ref
        )
      );
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.complete_deposit(text) is
  'Service role: finalize pending deposit by provider reference, credit depositor account_balance, and credit referrer referral bonus when profiles.referred_by is set.';
