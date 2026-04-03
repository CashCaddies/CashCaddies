-- Contest insurance engine: extend contest_insurance, missed_cut on golfer_scores, idempotent RPC after scoring.

-- FK for legacy contest_insurance rows (if not already present).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contest_insurance_contest_id_fkey'
  ) then
    alter table public.contest_insurance
      add constraint contest_insurance_contest_id_fkey
      foreign key (contest_id) references public.contests (id) on delete cascade;
  end if;
exception
  when others then null;
end $$;

alter table public.golfer_scores
  add column if not exists missed_cut boolean not null default false;

comment on column public.golfer_scores.missed_cut is
  'After scoring: true if golfer missed the cut; used for missed-cut insurance (not withdrawn).';

alter table public.contest_insurance
  add column if not exists wd_protection_enabled boolean not null default false;

alter table public.contest_insurance
  add column if not exists wd_refund_pct numeric not null default 100
    check (wd_refund_pct >= 0 and wd_refund_pct <= 100);

alter table public.contest_insurance
  add column if not exists missed_cut_insurance_enabled boolean not null default false;

alter table public.contest_insurance
  add column if not exists missed_cut_refund_pct numeric not null default 50
    check (missed_cut_refund_pct >= 0 and missed_cut_refund_pct <= 100);

alter table public.contest_insurance
  add column if not exists overlay_insurance_enabled boolean not null default false;

alter table public.contest_insurance
  add column if not exists overlay_guaranteed_prize_pool_usd numeric;

alter table public.contest_insurance
  drop constraint if exists contest_insurance_overlay_guaranteed_nonneg;

alter table public.contest_insurance
  add constraint contest_insurance_overlay_guaranteed_nonneg check (
    overlay_guaranteed_prize_pool_usd is null or overlay_guaranteed_prize_pool_usd >= 0
  );

comment on column public.contest_insurance.wd_protection_enabled is
  'Refund entry-fee portion when a protected golfer withdraws (golfers.withdrawn).';

comment on column public.contest_insurance.missed_cut_insurance_enabled is
  'Partial entry-fee refund when a protected golfer missed the cut (golfer_scores.missed_cut).';

comment on column public.contest_insurance.overlay_insurance_enabled is
  'If sum(entry_fee) < overlay_guaranteed_prize_pool_usd, credit each entrant their share of the shortfall.';

comment on table public.contest_insurance is
  'Per-contest insurance products: WD protection, missed cut, overlay (see column comments).';

create table if not exists public.contest_insurance_runs (
  contest_id text primary key,
  processed_at timestamptz not null default now(),
  total_credited_usd numeric not null default 0 check (total_credited_usd >= 0)
);

comment on table public.contest_insurance_runs is
  'One row per contest after automatic insurance payouts; prevents double processing.';

create index if not exists contest_insurance_runs_processed_at_idx
  on public.contest_insurance_runs (processed_at desc);

alter table public.contest_insurance_runs enable row level security;

grant select on public.contest_insurance_runs to anon, authenticated;

alter table public.transactions
  add column if not exists type text not null default 'credit';

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check check (
    type in (
      'entry',
      'credit',
      'refund',
      'protection_purchase',
      'contest_prize',
      'contest_insurance_payout'
    )
  );

comment on constraint transactions_type_check on public.transactions is
  'contest_insurance_payout: automatic WD / missed-cut / overlay credits.';

drop function if exists public.process_contest_insurance(text) cascade;
create or replace function public.process_contest_insurance(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid text;
  v_contest record;
  v_wd_on boolean;
  v_wd_pct numeric;
  v_mc_on boolean;
  v_mc_pct numeric;
  v_ov_on boolean;
  v_ov_guaranteed numeric;
  v_eligible_after timestamptz;
  ce record;
  v_wd_amt numeric;
  v_mc_amt numeric;
  v_paid numeric;
  v_cap numeric;
  v_ef numeric;
  v_total_out numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_one jsonb;
  v_actual_pool numeric;
  v_guaranteed numeric;
  v_shortfall numeric;
  v_n int;
  v_each numeric;
  v_extra numeric;
  v_i int;
  v_share numeric;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  select * into v_contest from public.contests c where c.id = v_cid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if exists (select 1 from public.contest_insurance_runs r where r.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'Contest insurance already processed.');
  end if;

  -- After scoring window: at least 1 day post lock (set golfer_scores / withdrawn flags first).
  v_eligible_after := v_contest.starts_at + interval '1 day';
  if now() < v_eligible_after then
    return jsonb_build_object(
      'ok', false,
      'error',
      'Insurance processing opens 24 hours after contest start (after scoring).'
    );
  end if;

  select
    coalesce(ci.wd_protection_enabled, false),
    coalesce(ci.wd_refund_pct, 0::numeric),
    coalesce(ci.missed_cut_insurance_enabled, false),
    coalesce(ci.missed_cut_refund_pct, 0::numeric),
    coalesce(ci.overlay_insurance_enabled, false),
    ci.overlay_guaranteed_prize_pool_usd
  into v_wd_on, v_wd_pct, v_mc_on, v_mc_pct, v_ov_on, v_ov_guaranteed
  from public.contest_insurance ci
  where ci.contest_id = v_cid;

  if not found then
    v_wd_on := false;
    v_wd_pct := 0;
    v_mc_on := false;
    v_mc_pct := 0;
    v_ov_on := false;
    v_ov_guaranteed := null;
  end if;

  select count(*)::int into v_n from public.contest_entries ce where ce.contest_id = v_cid;
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'No contest entries.');
  end if;

  -- Per-entry: WD + missed cut (capped by entry_fee), only when CashCaddie protection was purchased.
  for ce in
    select *
    from public.contest_entries ce
    where ce.contest_id = v_cid
  loop
    v_wd_amt := 0;
    v_mc_amt := 0;
    v_ef := round(greatest(coalesce(ce.entry_fee, 0), 0)::numeric, 2);

    if coalesce(ce.protection_enabled, false) and ce.lineup_id is not null then
      if v_wd_on and v_wd_pct > 0 and v_ef > 0 then
        if exists (
          select 1
          from public.lineup_players lp
          inner join public.golfers g on g.id = lp.golfer_id
          where lp.lineup_id = ce.lineup_id
            and lp.is_protected
            and coalesce(g.withdrawn, false)
        ) then
          v_wd_amt := round(v_ef * v_wd_pct / 100.0, 2);
        end if;
      end if;

      if v_mc_on and v_mc_pct > 0 and v_ef > 0 then
        if exists (
          select 1
          from public.lineup_players lp
          inner join public.golfers g on g.id = lp.golfer_id
          left join public.golfer_scores gs
            on gs.golfer_id = lp.golfer_id
            and gs.contest_id = v_cid
          where lp.lineup_id = ce.lineup_id
            and lp.is_protected
            and not coalesce(g.withdrawn, false)
            and coalesce(gs.missed_cut, false)
        ) then
          v_mc_amt := round(v_ef * v_mc_pct / 100.0, 2);
        end if;
      end if;
    end if;

    v_cap := v_ef;
    v_paid := 0;

    if v_wd_amt > 0 then
      v_paid := least(v_wd_amt, v_cap);
      if v_paid > 0 then
        insert into public.profiles (id)
        values (ce.user_id)
        on conflict (id) do nothing;

        update public.profiles p
        set
          account_balance = round(coalesce(p.account_balance, 0)::numeric + v_paid, 2),
          updated_at = now()
        where p.id = ce.user_id;

        insert into public.transactions (user_id, amount, type, description)
        values (
          ce.user_id,
          v_paid,
          'contest_insurance_payout',
          format(
            'Insurance — WD protection — %s (%s)',
            coalesce(nullif(trim(v_contest.name), ''), v_cid),
            v_cid
          )
        );

        v_total_out := round(v_total_out + v_paid, 2);
        v_one := jsonb_build_object(
          'kind', 'wd_protection',
          'contest_entry_id', ce.id,
          'user_id', ce.user_id,
          'amount_usd', v_paid
        );
        v_breakdown := v_breakdown || jsonb_build_array(v_one);
      end if;
    end if;

    if v_mc_amt > 0 and v_cap > v_paid then
      v_mc_amt := least(v_mc_amt, round(v_cap - v_paid, 2));
      if v_mc_amt > 0 then
        insert into public.profiles (id)
        values (ce.user_id)
        on conflict (id) do nothing;

        update public.profiles p
        set
          account_balance = round(coalesce(p.account_balance, 0)::numeric + v_mc_amt, 2),
          updated_at = now()
        where p.id = ce.user_id;

        insert into public.transactions (user_id, amount, type, description)
        values (
          ce.user_id,
          v_mc_amt,
          'contest_insurance_payout',
          format(
            'Insurance — missed cut — %s (%s)',
            coalesce(nullif(trim(v_contest.name), ''), v_cid),
            v_cid
          )
        );

        v_total_out := round(v_total_out + v_mc_amt, 2);
        v_one := jsonb_build_object(
          'kind', 'missed_cut',
          'contest_entry_id', ce.id,
          'user_id', ce.user_id,
          'amount_usd', v_mc_amt
        );
        v_breakdown := v_breakdown || jsonb_build_array(v_one);
      end if;
    end if;
  end loop;

  -- Overlay: credit each entrant equally if actual entry-fee pool falls short of guarantee.
  if v_ov_on and v_ov_guaranteed is not null and v_ov_guaranteed > 0 then
    select coalesce(sum(round(greatest(coalesce(ce.entry_fee, 0), 0)::numeric, 2)), 0)
    into v_actual_pool
    from public.contest_entries ce
    where ce.contest_id = v_cid;

    v_guaranteed := round(v_ov_guaranteed, 2);
    if v_actual_pool < v_guaranteed then
      v_shortfall := round(v_guaranteed - v_actual_pool, 2);
      if v_shortfall > 0 and v_n > 0 then
        v_each := round(v_shortfall / v_n::numeric, 2);
        v_extra := round(v_shortfall - (v_each * v_n::numeric), 2);
        v_i := 0;

        for ce in
          select *
          from public.contest_entries ce
          where ce.contest_id = v_cid
          order by ce.created_at asc, ce.id asc
        loop
          v_i := v_i + 1;
          v_share := v_each;
          if v_i = 1 then
            v_share := round(v_share + v_extra, 2);
          end if;

          if v_share > 0 then
            insert into public.profiles (id)
            values (ce.user_id)
            on conflict (id) do nothing;

            update public.profiles p
            set
              account_balance = round(coalesce(p.account_balance, 0)::numeric + v_share, 2),
              updated_at = now()
            where p.id = ce.user_id;

            insert into public.transactions (user_id, amount, type, description)
            values (
              ce.user_id,
              v_share,
              'contest_insurance_payout',
              format(
                'Insurance — overlay — %s (%s)',
                coalesce(nullif(trim(v_contest.name), ''), v_cid),
                v_cid
              )
            );

            v_total_out := round(v_total_out + v_share, 2);
            v_one := jsonb_build_object(
              'kind', 'overlay',
              'contest_entry_id', ce.id,
              'user_id', ce.user_id,
              'amount_usd', v_share
            );
            v_breakdown := v_breakdown || jsonb_build_array(v_one);
          end if;
        end loop;
      end if;
    end if;
  end if;

  insert into public.contest_insurance_runs (contest_id, total_credited_usd)
  values (v_cid, v_total_out);

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'total_credited_usd', v_total_out,
    'lines', v_breakdown
  );
exception
  when others then
    raise;
end;
$$;

comment on function public.process_contest_insurance(text) is
  'After scoring: WD refunds (protected + withdrawn), missed-cut partial refunds, overlay pool shortfall split; idempotent.';

grant execute on function public.process_contest_insurance(text) to service_role;

-- One settings row per contest (toggle columns in Supabase or SQL).
insert into public.contest_insurance (contest_id)
select c.id
from public.contests c
on conflict (contest_id) do nothing;
