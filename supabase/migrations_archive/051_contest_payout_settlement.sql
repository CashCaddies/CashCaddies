-- Automated contest prize distribution: leaderboard order, contest_payouts % of prize pool, credit wallets once.

alter table public.transactions
  add column if not exists type text not null default 'credit';

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check check (
    type in ('entry', 'credit', 'refund', 'protection_purchase', 'contest_prize')
  );

comment on constraint transactions_type_check on public.transactions is
  'contest_prize: positive amount, prize payout after contest settlement.';

create table if not exists public.contest_settlements (
  contest_id text primary key,
  settled_at timestamptz not null default now(),
  prize_pool_usd numeric not null check (prize_pool_usd >= 0),
  entry_count integer not null check (entry_count >= 1),
  distributed_usd numeric not null check (distributed_usd >= 0)
);

comment on table public.contest_settlements is
  'One row per contest after prizes are distributed; prevents double settlement.';

create index if not exists contest_settlements_settled_at_idx on public.contest_settlements (settled_at desc);

alter table public.contest_settlements enable row level security;

grant select on public.contest_settlements to anon, authenticated;

/**
 * Prize pool = contests.entry_fee_usd * entry count (matches contests_with_stats.prize_pool logic).
 * Eligible when now() >= starts_at + 3 days (DFS scoring window; aligns with app "Ended" status).
 * Idempotent: refuses if contest_settlements row exists.
 */
drop function if exists public.settle_contest_prizes(text) cascade;
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
  'Sort leaderboard by lineup total_score, apply contest_payouts, credit account_balance and transactions (idempotent per contest).';

grant execute on function public.settle_contest_prizes(text) to service_role;
