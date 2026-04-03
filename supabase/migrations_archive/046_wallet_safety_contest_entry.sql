-- Paid branch: wallet checks + create_contest_entry_atomic (replaces 044).

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock bigint;
  v_next int;
  v_has_prof boolean;
  v_total numeric;
  v_ce_id uuid;
  prof record;
  v_balance numeric;
  v_credits numeric;
  v_loy int;
  v_earn int;
  v_new_loy int;
  v_new_bal numeric;
  v_tier text;
  v_ef numeric;
  v_pf numeric;
begin
  v_ef := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  v_pf := round(greatest(coalesce(p_protection_fee, 0), 0)::numeric, 2);
  v_total := round(v_ef + v_pf, 2);

  if coalesce(p_total_paid, 0) <= 0 then
    v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
    perform pg_advisory_xact_lock(v_lock);

    select coalesce(max(ce.entry_number), 0) + 1
      into v_next
      from public.contest_entries ce
      where ce.user_id = p_user_id
        and ce.contest_id::text = p_contest_id;

    insert into public.contest_entries (
      user_id,
      contest_id,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_id,
      entry_number
    )
    values (
      p_user_id,
      p_contest_id,
      v_ef,
      v_pf,
      0,
      coalesce(p_protection_enabled, false),
      p_lineup_id,
      v_next
    )
    returning id into v_ce_id;

    return jsonb_build_object(
      'ok', true,
      'contest_entry_id', v_ce_id,
      'credits_restored', 0,
      'balance_restored', 0,
      'loyalty_points_earned', 0
    );
  end if;

  v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
  perform pg_advisory_xact_lock(v_lock);

  select coalesce(max(ce.entry_number), 0) + 1
    into v_next
    from public.contest_entries ce
    where ce.user_id = p_user_id
      and ce.contest_id::text = p_contest_id;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    p.id,
    round(coalesce(p.account_balance, 0)::numeric, 2) as account_balance,
    round(coalesce(p.site_credits, 0)::numeric, 2) as site_credits,
    greatest(0, floor(coalesce(p.loyalty_points, 0))::int) as loyalty_points
  into prof
  from public.profiles p
  where p.id = p_user_id
  for update;

  v_has_prof := found;
  if not v_has_prof then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  v_balance := prof.account_balance;
  v_credits := prof.site_credits;
  v_loy := prof.loyalty_points;

  if v_ef > 0 and v_balance < v_ef then
    raise exception using
      message = format(
        'Insufficient account balance for contest entry fee. Need $%s (account balance is $%s).',
        v_ef::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  if v_balance < v_total then
    raise exception using
      message = format(
        'Insufficient account balance. Need $%s (entry fee + protection, account balance is $%s).',
        v_total::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  v_new_bal := round(v_balance - v_total, 2);
  if v_new_bal < 0 then
    raise exception using
      message = 'Contest entry would result in a negative account balance.',
      errcode = 'P0001';
  end if;

  v_earn := floor(v_ef * 10)::int;
  v_new_loy := v_loy + v_earn;
  v_tier := public.loyalty_tier_from_points(v_new_loy);

  insert into public.contest_entries (
    user_id,
    contest_id,
    entry_fee,
    protection_fee,
    total_paid,
    protection_enabled,
    lineup_id,
    entry_number
  )
  values (
    p_user_id,
    p_contest_id,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next
  )
  returning id into v_ce_id;

  if v_ef > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_ef,
      'entry',
      format('Contest entry - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), p_contest_id)
    );
  end if;

  if v_pf > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_pf,
      'protection_purchase',
      format('CashCaddie Protection - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), p_contest_id)
    );
  end if;

  update public.profiles
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'contest_entry_id', v_ce_id,
    'credits_restored', 0,
    'balance_restored', v_total,
    'loyalty_points_earned', v_earn
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate contest entry (same user, contest, and entry slot).');
  when others then
    raise;
end;
$$;
