-- Idempotent lobby entry: optional p_idempotency_key on contest_entries (column from 20260421386000).
-- Replaces 8-arg create_contest_entry_atomic and 3-arg enter_contest_atomic (signature change).

drop function if exists public.enter_contest_atomic(uuid, uuid, jsonb);
drop function if exists public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text
);

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
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
  v_cid uuid;
  v_ik text;
begin
  v_cid := trim(p_contest_id)::uuid;
  v_ik := nullif(trim(coalesce(p_idempotency_key, '')), '');

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
        and ce.contest_id = v_cid;

    insert into public.contest_entries (
      user_id,
      contest_id,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_id,
      entry_number,
      idempotency_key
    )
    values (
      p_user_id,
      v_cid,
      v_ef,
      v_pf,
      0,
      coalesce(p_protection_enabled, false),
      p_lineup_id,
      v_next,
      v_ik
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
      and ce.contest_id = v_cid;

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
    entry_number,
    idempotency_key
  )
  values (
    p_user_id,
    v_cid,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next,
    v_ik
  )
  returning id into v_ce_id;

  if v_ef > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_ef,
      'entry',
      format('Contest entry - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), v_cid::text)
    );
  end if;

  if v_pf > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_pf,
      'protection_purchase',
      format('CashCaddie Protection - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), v_cid::text)
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
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'Invalid contest id (expected UUID).');
  when others then
    raise;
end;
$$;

comment on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, text
) is
  'Atomic: contest_entries + wallet debit from account_balance only. Optional p_idempotency_key stored on contest_entries.';

revoke all on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, text
) from public;

grant execute on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, text
) to anon;
grant execute on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, text
) to authenticated;
grant execute on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, text
) to service_role;

create or replace function public.enter_contest_atomic(
  p_user_id uuid,
  p_contest_id uuid,
  p_lineup jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_c public.contests;
  v_lineup_id uuid;
  v_fee numeric;
  v_user_entries int;
  v_ik text;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null or p_contest_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_arguments');
  end if;

  v_lineup_id := nullif(trim(coalesce(p_lineup ->> 'lineup_id', '')), '')::uuid;
  if v_lineup_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_lineup_id',
      'message', 'Use p_lineup = jsonb_build_object(''lineup_id'', <saved lineups.id>). Roster JSON is created via lineups + lineup_players in the app first.'
    );
  end if;

  v_ik := nullif(trim(coalesce(p_idempotency_key, '')), '');
  if v_ik is not null then
    perform pg_advisory_xact_lock(hashtext('cc:enter:idem:' || v_ik));
    perform 1
    from public.contest_entries ce
    where ce.idempotency_key = v_ik
    limit 1;
    if found then
      return jsonb_build_object(
        'ok', true,
        'message', 'Already processed'
      );
    end if;
  end if;

  select *
  into v_c
  from public.contests c
  where c.id = p_contest_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'contest_not_found');
  end if;

  if now() >= v_c.start_time then
    raise exception 'Contest locked';
  end if;

  if lower(trim(coalesce(v_c.status, ''))) is distinct from 'filling' then
    return jsonb_build_object('ok', false, 'error', 'contest_not_open', 'status', v_c.status);
  end if;

  if coalesce(v_c.current_entries, 0) >= coalesce(v_c.max_entries, 1) then
    return jsonb_build_object('ok', false, 'error', 'contest_full');
  end if;

  select count(*)::int
  into v_user_entries
  from public.contest_entries ce
  where ce.user_id = p_user_id
    and ce.contest_id = p_contest_id;

  if v_user_entries >= greatest(1, coalesce(v_c.max_entries_per_user, 1)) then
    return jsonb_build_object('ok', false, 'error', 'entry_limit_reached');
  end if;

  v_fee := greatest(
    0,
    round(
      case
        when v_c.entry_fee_cents is not null then v_c.entry_fee_cents::numeric / 100.0
        else coalesce(v_c.entry_fee_usd, v_c.entry_fee, 0)::numeric
      end,
      2
    )
  );

  return public.create_contest_entry_atomic(
    p_user_id,
    p_contest_id::text,
    v_fee,
    0::numeric,
    v_fee,
    false,
    v_lineup_id,
    coalesce(nullif(trim(v_c.name), ''), 'Contest'),
    v_ik
  );
end;
$$;

comment on function public.enter_contest_atomic(uuid, uuid, jsonb, text) is
  'Lobby entry: optional p_idempotency_key; p_lineup.lineup_id; delegates to create_contest_entry_atomic.';

revoke all on function public.enter_contest_atomic(uuid, uuid, jsonb, text) from public;

grant execute on function public.enter_contest_atomic(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.enter_contest_atomic(uuid, uuid, jsonb, text) to service_role;
