-- Contest-level settlement only: one contest_settlements row (no per-entry rows, no wallet/transactions yet).

drop function if exists public.settle_contest_prizes(text);
drop function if exists public.settle_contest_prizes(uuid);

create or replace function public.settle_contest_prizes(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid text;
  v_prize_pool numeric;
  v_entry_count int;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  if not exists (select 1 from public.contests c where c.id = v_cid::uuid) then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if exists (
    select 1
    from public.contest_settlements s
    where trim(s.contest_id) = trim(v_cid)
  ) then
    raise exception 'Contest already settled';
  end if;

  select count(*)::int
  into v_entry_count
  from public.contest_entries ce
  where ce.contest_id = v_cid::uuid;

  select round(coalesce(sum(coalesce(ce.entry_fee::numeric, 0)), 0) * 0.9, 2)
  into v_prize_pool
  from public.contest_entries ce
  where ce.contest_id = v_cid::uuid;

  insert into public.contest_settlements (
    contest_id,
    prize_pool_usd,
    entry_count,
    distributed_usd
  )
  values (
    v_cid,
    coalesce(v_prize_pool, 0),
    coalesce(v_entry_count, 0),
    coalesce(v_prize_pool, 0)
  );

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'prize_pool_usd', coalesce(v_prize_pool, 0),
    'entry_count', coalesce(v_entry_count, 0),
    'distributed_usd', coalesce(v_prize_pool, 0),
    'payouts', '[]'::jsonb
  );
end;
$$;

alter function public.settle_contest_prizes(text) owner to postgres;

comment on function public.settle_contest_prizes(text) is
  'MVP: records one contest_settlements row (90% of sum(entry_fee), counts entries). No per-user payouts.';

grant all on function public.settle_contest_prizes(text) to anon;
grant all on function public.settle_contest_prizes(text) to authenticated;
grant all on function public.settle_contest_prizes(text) to service_role;
