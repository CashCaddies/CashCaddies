-- Re-apply settle_contest_prizes if 20260421120000 already ran before trim/NOTICE were added.
-- TEXT contest_id values may differ by whitespace; match with trim(...) = trim(v_cid).
-- TEMP: RAISE NOTICE for payout lookup debugging (remove when no longer needed).

create or replace function public.settle_contest_prizes(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid text;
  v_contest record;
  v_entry_count int;
  v_prize_pool numeric;
  total_payouts numeric;
  expected_pool numeric;
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

  select * into v_contest from public.contests c where c.id = v_cid::uuid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if lower(trim(coalesce(v_contest.status::text, ''))) = 'settled' then
    raise exception 'Contest already settled';
  end if;

  if exists (select 1 from public.contest_settlements s where trim(s.contest_id) = trim(v_cid)) then
    return jsonb_build_object('ok', false, 'error', 'Contest already settled.');
  end if;

  if lower(trim(coalesce(v_contest.status::text, ''))) is distinct from 'complete' then
    return jsonb_build_object(
      'ok', false,
      'error',
      'Contest must be in complete status before settlement.'
    );
  end if;

  select count(*)::int into v_entry_count from public.contest_entries ce where ce.contest_id = v_cid::uuid;

  if v_entry_count = 0 then
    update public.contests
    set status = 'settled'
    where id = v_cid::uuid;

    insert into public.contest_settlements (contest_id, prize_pool_usd, entry_count, distributed_usd)
    values (v_cid, 0, 0, 0);

    return jsonb_build_object(
      'ok', true,
      'contest_id', v_cid,
      'prize_pool_usd', 0,
      'entry_count', 0,
      'distributed_usd', 0,
      'payouts', '[]'::jsonb
    );
  end if;

  raise notice 'Looking for payouts with contest_id: %', v_cid;

  if not exists (select 1 from public.contest_payouts pp where trim(pp.contest_id) = trim(v_cid)) then
    return jsonb_build_object('ok', false, 'error', 'No payout structure for this contest (contest_payouts).');
  end if;

  select coalesce(sum(payout_amount), 0)
  into total_payouts
  from public.contest_payouts
  where trim(contest_id) = trim(v_cid);

  select (coalesce(c.entry_fee, c.entry_fee_usd, 0)::numeric * v_entry_count * 0.90)
  into expected_pool
  from public.contests c
  where c.id = v_cid::uuid;

  if round(total_payouts::numeric, 2) <> round(expected_pool::numeric, 2) then
    raise exception 'Payouts do not match prize pool';
  end if;

  v_prize_pool := round(expected_pool, 2);
  if v_prize_pool <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Prize pool is zero; nothing to distribute.');
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
    where ce.contest_id = v_cid::uuid
  ) ranked;

  if v_winners is null or array_length(v_winners, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Could not build leaderboard.');
  end if;

  v_len := array_length(v_winners, 1);
  for r_payout in
    select pp.rank_place, pp.payout_pct
    from public.contest_payouts pp
    where trim(pp.contest_id) = trim(v_cid)
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

    insert into public.profiles (id) values (v_user_id) on conflict (id) do nothing;

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
      format('Contest prize — %s (place %s)', coalesce(nullif(trim(v_contest.name), ''), v_cid), r_payout.rank_place)
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
end;
$$;
