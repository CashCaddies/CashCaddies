-- Contest entry: consume protection_credit_balance before account_balance; audit via protection_credit_spend.

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check check (
    type in (
      'entry',
      'contest_entry',
      'credit',
      'refund',
      'protection_purchase',
      'contest_prize',
      'contest_insurance_payout',
      'test_credit',
      'protection_credit',
      'protection_credit_spend'
    )
  );

comment on constraint transactions_type_check on public.transactions is
  'protection_credit: payout from Community Protection; protection_credit_spend: entry paid using that credit.';

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
  v_pc numeric;
  v_from_pc numeric;
  v_from_cash numeric;
  v_from_pc_entry numeric;
  v_from_pc_prot numeric;
  v_cash_entry numeric;
  v_cash_prot numeric;
  v_loy int;
  v_earn int;
  v_new_loy int;
  v_new_bal numeric;
  v_new_pc numeric;
  v_tier text;
  v_ef numeric;
  v_pf numeric;
  v_cid uuid;
  v_name text;
  v_cap int;
  v_per_user int;
  n_total bigint;
  n_user bigint;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  v_cid := trim(p_contest_id)::uuid;
  v_name := coalesce(nullif(trim(p_contest_name), ''), 'Contest');

  v_ef := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  v_pf := round(greatest(coalesce(p_protection_fee, 0), 0)::numeric, 2);
  v_total := round(v_ef + v_pf, 2);

  v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
  perform pg_advisory_xact_lock(v_lock);

  if public.contest_is_past_start(v_cid::text) then
    raise exception 'Contest has started; entries are closed.'
      using errcode = 'P0001';
  end if;

  select c.max_entries, c.max_entries_per_user
  into v_cap, v_per_user
  from public.contests c
  where c.id = v_cid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  v_cap := greatest(1, coalesce(v_cap, 1));

  select count(*)::bigint
  into n_total
  from public.contest_entries ce
  where ce.contest_id = v_cid;

  if n_total >= v_cap then
    raise exception 'This contest is full.'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint
  into n_user
  from public.contest_entries ce
  where ce.contest_id = v_cid
    and ce.user_id = p_user_id;

  if n_user >= coalesce(v_per_user, 999999) then
    raise exception 'Maximum entries reached for this contest.'
      using errcode = 'P0001';
  end if;

  select coalesce(max(ce.entry_number), 0) + 1
    into v_next
    from public.contest_entries ce
    where ce.user_id = p_user_id
      and ce.contest_id = v_cid;

  if coalesce(p_total_paid, 0) <= 0 then
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
      v_cid,
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
      'protection_credit_restored', 0,
      'loyalty_points_earned', 0
    );
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    p.id,
    round(coalesce(p.account_balance, 0)::numeric, 2) as account_balance,
    round(coalesce(p.site_credits, 0)::numeric, 2) as site_credits,
    round(coalesce(p.protection_credit_balance, 0)::numeric, 2) as protection_credit_balance,
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
  v_pc := prof.protection_credit_balance;
  v_loy := prof.loyalty_points;

  v_from_pc := least(v_total, v_pc);
  v_from_cash := round(v_total - v_from_pc, 2);

  if v_from_cash > v_balance then
    raise exception using
      message = format(
        'Insufficient funds for contest entry. Need $%s from account balance (have $%s) after applying $%s from protection credit (have $%s).',
        v_from_cash::text,
        v_balance::text,
        v_from_pc::text,
        v_pc::text
      ),
      errcode = 'P0001';
  end if;

  v_from_pc_entry := least(v_ef, v_from_pc);
  v_from_pc_prot := round(v_from_pc - v_from_pc_entry, 2);
  v_cash_entry := round(v_ef - v_from_pc_entry, 2);
  v_cash_prot := round(v_pf - v_from_pc_prot, 2);

  v_new_bal := round(v_balance - v_from_cash, 2);
  v_new_pc := round(v_pc - v_from_pc, 2);
  if v_new_bal < 0 or v_new_pc < 0 then
    raise exception using
      message = 'Contest entry would result in negative balances.',
      errcode = 'P0001';
  end if;

  v_earn := floor(v_ef * 10)::int;
  v_new_loy := v_loy + v_earn;
  v_tier := public.loyalty_tier_from_points(v_new_loy);

  update public.profiles p
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    protection_credit_balance = v_new_pc,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where p.id = p_user_id;

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
    v_cid,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next
  )
  returning id into v_ce_id;

  if v_from_pc > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_from_pc,
      'protection_credit_spend',
      format('Contest entry — %s (protection credit)', v_name)
    );
  end if;

  if v_cash_entry > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_cash_entry,
      'contest_entry',
      v_name
    );
  end if;

  if v_cash_prot > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_cash_prot,
      'protection_purchase',
      format('CashCaddie Protection — %s', v_name)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'contest_entry_id', v_ce_id,
    'credits_restored', 0,
    'balance_restored', v_from_cash,
    'protection_credit_restored', v_from_pc,
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

comment on function public.create_contest_entry_atomic is
  'Creates contest_entries row; debits protection_credit_balance first, then account_balance; inserts transactions.';

-- ---------------------------------------------------------------------------
-- RLS: notifications + protection audit (read for own user)
-- ---------------------------------------------------------------------------
alter table public.user_notifications enable row level security;

drop policy if exists "Users select own notifications" on public.user_notifications;
create policy "Users select own notifications"
  on public.user_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
  on public.user_notifications for update
  using (auth.uid() = user_id);

alter table public.protection_events enable row level security;

drop policy if exists "Users select own protection events" on public.protection_events;
create policy "Users select own protection events"
  on public.protection_events for select
  using (auth.uid() = user_id);

grant select, update on public.user_notifications to authenticated;
grant select on public.protection_events to authenticated;
