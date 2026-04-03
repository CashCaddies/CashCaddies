-- Cap cash wallet (`profiles.account_balance`) for beta credits: admin beta funding, contest prizes, entry refunds.

-- ---------------------------------------------------------------------------
-- Admin self-serve beta funding (matches 079_admin_beta_wallet_funding_description.sql)
-- ---------------------------------------------------------------------------
drop function if exists public.admin_add_beta_funds(numeric);

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
  v_prev numeric;
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

  select coalesce(p.account_balance, 0) into v_prev
  from public.profiles p
  where p.id = v_uid;

  if round(v_prev::numeric + p_amount, 2) > 5000::numeric then
    raise exception 'Wallet limit exceeded – contact admin'
      using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------
-- Contest settlement: prize credits (matches 051_contest_payout_settlement.sql)
-- ---------------------------------------------------------------------------
create or replace function public.settle_contest_prizes(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid text;
  v_contest record;
  v_entry_count int;
  v_prize_pool numeric;
  v_settles_after timestamptz;
  v_winners uuid[];
  v_len int;
  r_payout record;
  v_user_id uuid;
  v_amt numeric;
  v_total_out numeric := 0;
  v_payouts jsonb := '[]'::jsonb;
  v_one jsonb;
  v_cur_bal numeric;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  select * into v_contest from public.contests c where c.id = v_cid for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if exists (select 1 from public.contest_settlements s where s.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'Contest already settled.');
  end if;

  v_settles_after := v_contest.starts_at + interval '3 days';
  if now() < v_settles_after then
    return jsonb_build_object(
      'ok', false,
      'error',
      'Contest is not eligible for settlement yet. Settlement opens 3 days after contest start.'
    );
  end if;

  select count(*)::int into v_entry_count from public.contest_entries ce where ce.contest_id = v_cid;
  if v_entry_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'No entries to settle.');
  end if;

  v_prize_pool := round(v_contest.entry_fee_usd * v_entry_count, 2);
  if v_prize_pool <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Prize pool is zero; nothing to distribute.');
  end if;

  if not exists (select 1 from public.contest_payouts pp where pp.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'No payout structure for this contest (contest_payouts).');
  end if;

  select array_agg(user_id order by ord) into v_winners
  from (
    select
      ce.user_id,
      row_number() over (
        order by coalesce(l.total_score, 0) desc nulls last, ce.id
      ) as ord
    from public.contest_entries ce
    left join public.lineups l on l.id = ce.lineup_id
    where ce.contest_id = v_cid
  ) ranked;

  if v_winners is null or array_length(v_winners, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Could not build leaderboard.');
  end if;

  v_len := array_length(v_winners, 1);

  for r_payout in
    select pp.rank_place, pp.payout_pct
    from public.contest_payouts pp
    where pp.contest_id = v_cid
    order by pp.rank_place
  loop
    if r_payout.rank_place < 1 or r_payout.rank_place > v_len then
      continue;
    end if;

    v_user_id := v_winners[r_payout.rank_place];
    v_amt := round(v_prize_pool * r_payout.payout_pct / 100.0, 2);

    if v_amt <= 0 then
      continue;
    end if;

    insert into public.profiles (id)
    values (v_user_id)
    on conflict (id) do nothing;

    select coalesce(p.account_balance, 0) into v_cur_bal
    from public.profiles p
    where p.id = v_user_id;

    if round(v_cur_bal::numeric + v_amt, 2) > 5000::numeric then
      return jsonb_build_object('ok', false, 'error', 'Wallet limit exceeded – contact admin');
    end if;

    update public.profiles p
    set
      account_balance = round(coalesce(p.account_balance, 0)::numeric + v_amt, 2),
      updated_at = now()
    where p.id = v_user_id;

    insert into public.transactions (user_id, amount, type, description)
    values (
      v_user_id,
      v_amt,
      'contest_prize',
      format(
        'Contest prize — %s (place %s)',
        coalesce(nullif(trim(v_contest.name), ''), v_cid),
        r_payout.rank_place
      )
    );

    v_total_out := round(v_total_out + v_amt, 2);

    v_one := jsonb_build_object(
      'user_id', v_user_id,
      'rank_place', r_payout.rank_place,
      'amount_usd', v_amt,
      'payout_pct', r_payout.payout_pct
    );
    v_payouts := v_payouts || jsonb_build_array(v_one);
  end loop;

  insert into public.contest_settlements (contest_id, prize_pool_usd, entry_count, distributed_usd)
  values (v_cid, v_prize_pool, v_entry_count, v_total_out);

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'prize_pool_usd', v_prize_pool,
    'entry_count', v_entry_count,
    'distributed_usd', v_total_out,
    'payouts', v_payouts
  );
exception
  when others then
    raise;
end;
$$;

comment on function public.settle_contest_prizes(text) is
  'Sort leaderboard by lineup total_score, apply contest_payouts, credit account_balance and transactions (idempotent per contest). Rejects settlement if any prize would exceed beta wallet cap (5000 USD).';

grant execute on function public.settle_contest_prizes(text) to service_role;
