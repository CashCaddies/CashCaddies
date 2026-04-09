-- Entry fee split model:
-- - 90% prize pool
-- - 5% protection fund
-- - 5% platform revenue
-- Users are charged entry fee only (no added protection charge).

insert into public.app_config (key, value)
values ('platform_revenue_usd', '0')
on conflict (key) do nothing;

create or replace function public.apply_contest_entry_fee_allocation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_entry_delta numeric := 0;
  v_protection_delta numeric := 0;
  v_platform_delta numeric := 0;
  v_current_platform numeric := 0;
begin
  if tg_op = 'INSERT' then
    v_entry_delta := coalesce(new.entry_fee, 0)::numeric;
  elsif tg_op = 'DELETE' then
    v_entry_delta := -coalesce(old.entry_fee, 0)::numeric;
  else
    v_entry_delta := coalesce(new.entry_fee, 0)::numeric - coalesce(old.entry_fee, 0)::numeric;
  end if;

  if v_entry_delta = 0 then
    return coalesce(new, old);
  end if;

  v_protection_delta := round(v_entry_delta * 0.05, 2);
  v_platform_delta := round(v_entry_delta * 0.05, 2);

  update public.insurance_pool
  set
    total_balance = greatest(0, round(coalesce(total_balance, 0)::numeric + v_protection_delta, 2)),
    total_amount = greatest(0, round(coalesce(total_amount, 0)::numeric + v_protection_delta, 2))
  where id = (select id from public.insurance_pool order by created_at asc nulls last limit 1);

  select
    case
      when value ~ '^-?[0-9]+(\.[0-9]+)?$' then value::numeric
      else 0::numeric
    end
  into v_current_platform
  from public.app_config
  where key = 'platform_revenue_usd'
  for update;

  insert into public.app_config (key, value)
  values ('platform_revenue_usd', round(v_platform_delta, 2)::text)
  on conflict (key) do update
    set value = round(coalesce(v_current_platform, 0) + v_platform_delta, 2)::text;

  return coalesce(new, old);
end;
$$;

drop trigger if exists contest_entries_fee_allocation on public.contest_entries;
create trigger contest_entries_fee_allocation
after insert or update of entry_fee or delete on public.contest_entries
for each row execute function public.apply_contest_entry_fee_allocation();

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

  v_prize_pool := round(v_contest.entry_fee_usd * v_entry_count * 0.90, 2);
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
