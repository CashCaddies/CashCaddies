-- INSERT into contest_entry_results: ignore duplicate (contest_id, entry_id).

create or replace function public.run_contest_payouts(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid text;
  v_prize_pool numeric;
  v_entry_count int;
  v_payout_place_count int;
  v_expected_paid_count int;
  v_existing_count int;
  v_inserted int := 0;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'missing_contest_id');
  end if;

  perform pg_advisory_xact_lock(hashtext('run_contest_payouts:' || v_cid));

  select count(*)::int
  into v_entry_count
  from public.contest_entries ce
  where ce.contest_id = v_cid::uuid;

  select count(*)::int
  into v_payout_place_count
  from public.contest_payouts cp
  where trim(cp.contest_id) = trim(v_cid);

  v_expected_paid_count := least(v_entry_count, v_payout_place_count);

  select count(*)::int
  into v_existing_count
  from public.contest_entry_results
  where trim(contest_id) = trim(v_cid);

  if v_existing_count >= v_expected_paid_count and v_expected_paid_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'message', 'already_paid',
      'contest_id', v_cid
    );
  end if;

  select s.prize_pool_usd
  into v_prize_pool
  from public.contest_settlements s
  where trim(s.contest_id) = trim(v_cid);

  if not found or v_prize_pool is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'contest_not_settled'
    );
  end if;

  if not exists (
    select 1
    from public.contest_payouts p
    where trim(p.contest_id) = trim(v_cid)
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'no_payout_structure'
    );
  end if;

  insert into public.contest_entry_results (
    contest_id,
    entry_id,
    user_id,
    "rank",
    winnings_usd
  )
  select
    v_cid,
    r.entry_id,
    r.user_id,
    r.finish_rank,
    round(v_prize_pool * coalesce(cp.payout_pct, 0) / 100.0, 2)
  from (
    select
      ce.id as entry_id,
      ce.user_id,
      row_number() over (
        order by
          coalesce(l.total_score, 0) desc nulls last,
          ce.created_at asc nulls last,
          ce.id asc
      ) as finish_rank
    from public.contest_entries ce
    left join public.lineups l on l.id = ce.lineup_id
    where ce.contest_id = v_cid::uuid
  ) r
  inner join public.contest_payouts cp
    on trim(cp.contest_id) = trim(v_cid)
   and cp.rank_place = r.finish_rank
  on conflict (contest_id, entry_id) do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'prize_pool_usd', v_prize_pool,
    'rows_inserted', v_inserted
  );
end;
$$;
