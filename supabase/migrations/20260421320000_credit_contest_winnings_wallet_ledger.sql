-- Record contest prize credits in wallet_transactions (audit) alongside legacy transactions.

create or replace function public.credit_contest_winnings(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid text;
  v_contest_name text;
  v_prize_pool numeric;
  rec record;
  v_amt numeric;
  v_cur_bal numeric;
  v_users int := 0;
  v_total numeric := 0;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'missing_contest_id');
  end if;

  perform pg_advisory_xact_lock(hashtext('credit_contest_winnings:' || v_cid));

  if exists (
    select 1
    from public.contest_winnings_credits w
    where trim(w.contest_id) = trim(v_cid)
  ) then
    return jsonb_build_object(
      'ok', true,
      'message', 'already_credited',
      'contest_id', v_cid
    );
  end if;

  select s.prize_pool_usd
  into v_prize_pool
  from public.contest_settlements s
  where trim(s.contest_id) = trim(v_cid);

  if not found or v_prize_pool is null then
    return jsonb_build_object('ok', false, 'error', 'contest_not_settled');
  end if;

  if coalesce(v_prize_pool, 0) > 0
     and not exists (
       select 1
       from public.contest_entry_results r
       where trim(r.contest_id) = trim(v_cid)
     ) then
    return jsonb_build_object('ok', false, 'error', 'no_entry_results');
  end if;

  select c.name into v_contest_name from public.contests c where c.id = v_cid::uuid;

  for rec in
    select
      r.user_id,
      round(sum(r.winnings_usd)::numeric, 2) as total_usd
    from public.contest_entry_results r
    where trim(r.contest_id) = trim(v_cid)
    group by r.user_id
  loop
    v_amt := rec.total_usd;
    if v_amt is null or v_amt <= 0 then
      continue;
    end if;

    insert into public.profiles (id) values (rec.user_id) on conflict (id) do nothing;

    select coalesce(p.account_balance, 0) into v_cur_bal
    from public.profiles p
    where p.id = rec.user_id;

    if round(v_cur_bal::numeric + v_amt, 2) > 5000::numeric then
      return jsonb_build_object('ok', false, 'error', 'wallet_limit_exceeded');
    end if;

    update public.profiles p
    set
      account_balance = round(coalesce(p.account_balance, 0)::numeric + v_amt, 2),
      updated_at = now()
    where p.id = rec.user_id;

    insert into public.transactions (user_id, amount, type, description)
    values (
      rec.user_id,
      v_amt,
      'contest_prize',
      format(
        'Contest winnings — %s',
        coalesce(nullif(trim(v_contest_name), ''), v_cid)
      )
    );

    insert into public.wallet_transactions (
      user_id,
      type,
      amount,
      reference_id
    )
    values (
      rec.user_id,
      'winnings',
      v_amt,
      v_cid
    );

    v_users := v_users + 1;
    v_total := round(v_total + v_amt, 2);
  end loop;

  update public.contest_entry_results
  set
    paid = true,
    paid_at = now()
  where trim(contest_id) = trim(v_cid);

  insert into public.contest_winnings_credits (contest_id)
  values (v_cid);

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'users_credited', v_users,
    'total_credited_usd', v_total
  );
end;
$$;

alter function public.credit_contest_winnings(text) owner to postgres;
