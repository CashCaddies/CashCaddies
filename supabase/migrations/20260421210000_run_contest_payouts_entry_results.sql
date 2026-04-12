-- Payout distribution AFTER settlement: uses contest_settlements.prize_pool_usd + contest_payouts (rank_place, payout_pct).
-- Does not modify settle_contest_prizes. Rankings from lineups.total_score (then created_at, id).

create table if not exists public.contest_entry_results (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  entry_id uuid not null,
  user_id uuid not null,
  "rank" integer not null,
  winnings_usd numeric not null,
  created_at timestamptz not null default now(),
  constraint contest_entry_results_winnings_usd_check check (winnings_usd >= 0),
  constraint contest_entry_results_rank_check check (("rank" >= 1) and ("rank" <= 500)),
  constraint contest_entry_results_entry_id_fkey foreign key (entry_id) references public.contest_entries (id) on delete cascade,
  constraint contest_entry_results_contest_entry_unique unique (contest_id, entry_id)
);

create index if not exists contest_entry_results_contest_id_idx on public.contest_entry_results (contest_id);

comment on table public.contest_entry_results is
  'Per-entry payout breakdown after settlement; written by run_contest_payouts (idempotent per contest).';

alter table public.contest_entry_results owner to postgres;

alter table public.contest_entry_results enable row level security;

grant select on table public.contest_entry_results to anon, authenticated;
grant all on table public.contest_entry_results to service_role;

drop function if exists public.run_contest_payouts(text);

create or replace function public.run_contest_payouts(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid text;
  v_prize_pool numeric;
  v_existing int;
  v_inserted int := 0;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'missing_contest_id');
  end if;

  perform pg_advisory_xact_lock(hashtext('run_contest_payouts:' || v_cid));

  select count(*)::int
  into v_existing
  from public.contest_entry_results
  where trim(contest_id) = trim(v_cid);

  if v_existing > 0 then
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
   and cp.rank_place = r.finish_rank;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'prize_pool_usd', v_prize_pool,
    'rows_inserted', v_inserted
  );
end;
$$;

alter function public.run_contest_payouts(text) owner to postgres;

comment on function public.run_contest_payouts(text) is
  'After settlement: allocate contest_settlements.prize_pool_usd by contest_payouts.rank_place / payout_pct into contest_entry_results. Idempotent.';

grant all on function public.run_contest_payouts(text) to anon;
grant all on function public.run_contest_payouts(text) to authenticated;
grant all on function public.run_contest_payouts(text) to service_role;
