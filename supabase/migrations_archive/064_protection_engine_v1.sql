-- CashCaddies Protection Engine v1: protection credit, pool payouts, swap state, notifications, scoring overlay.

-- ---------------------------------------------------------------------------
-- profiles: non-withdrawable protection credit (used before cash on entry)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists protection_credit_balance numeric not null default 0
    constraint profiles_protection_credit_balance_nonneg check (protection_credit_balance >= 0);

comment on column public.profiles.protection_credit_balance is
  'Community Protection Credit from WD/DNS/DQ events; spendable on contest entry only before cash; not withdrawable; does not expire.';

-- ---------------------------------------------------------------------------
-- transactions: protection_credit (positive) when protection applies
-- ---------------------------------------------------------------------------
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
      'protection_credit'
    )
  );

comment on constraint transactions_type_check on public.transactions is
  'protection_credit: credit to user when Community Protection applies (WD/DNS/DQ).';

-- ---------------------------------------------------------------------------
-- protection_events: audit trail (per user request; separate from insurance_events)
-- ---------------------------------------------------------------------------
create table if not exists public.protection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null references public.contests (id) on delete restrict,
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  golfer_id uuid not null references public.golfers (id) on delete restrict,
  event_type text not null
    constraint protection_events_event_type_check
      check (event_type in ('wd', 'dns', 'dq')),
  protection_amount numeric not null check (protection_amount >= 0),
  contest_entry_id uuid references public.contest_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint protection_events_lineup_golfer_contest unique (lineup_id, golfer_id, contest_id)
);

create index if not exists protection_events_user_created_idx
  on public.protection_events (user_id, created_at desc);

comment on table public.protection_events is
  'Player protection payouts: WD/DNS/DQ; pairs with protection_credit transaction and insurance_transactions pool debit.';

-- ---------------------------------------------------------------------------
-- user_notifications: in-app banner + history
-- ---------------------------------------------------------------------------
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'protection',
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

comment on table public.user_notifications is
  'In-app notifications; protection kind used for Community Protection Fund messages.';

-- ---------------------------------------------------------------------------
-- golfer_scores: per-contest playing status for WD/DNS/DQ and tee time
-- ---------------------------------------------------------------------------
alter table public.golfer_scores
  add column if not exists playing_status text not null default 'not_started'
    constraint golfer_scores_playing_status_check
      check (playing_status in ('not_started', 'active', 'wd', 'dns', 'dq'));

alter table public.golfer_scores
  add column if not exists has_teed_off boolean not null default false;

alter table public.golfer_scores
  add column if not exists tee_time timestamptz;

comment on column public.golfer_scores.playing_status is
  'Contest-specific status: wd/dns/dq trigger protection evaluation; active/not_started for swap eligibility.';

comment on column public.golfer_scores.has_teed_off is
  'True once the golfer has teed off in this contest; used for swap eligibility.';

-- ---------------------------------------------------------------------------
-- lineup_players: UI status + scoring overlay after protection applies
-- ---------------------------------------------------------------------------
alter table public.lineup_players
  add column if not exists protection_ui_status text
    constraint lineup_players_protection_ui_status_check
      check (
        protection_ui_status is null
        or protection_ui_status in ('swap_available', 'protected', 'teed_off')
      );

alter table public.lineup_players
  add column if not exists swap_available_until timestamptz;

alter table public.lineup_players
  add column if not exists protection_applied_at timestamptz;

alter table public.lineup_players
  add column if not exists counts_as_zero_for_scoring boolean not null default false;

comment on column public.lineup_players.protection_ui_status is
  'swap_available | protected | teed_off — LIVE tags in lineup UI.';

comment on column public.lineup_players.counts_as_zero_for_scoring is
  'When true, this golfer contributes 0 fantasy points to lineup total (protected lineup remains prize-eligible).';

-- ---------------------------------------------------------------------------
-- Scoring: protected golfers score 0
-- ---------------------------------------------------------------------------
create or replace function public.refresh_lineup_total_scores_for_contest(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else coalesce(gs.total_score, g.fantasy_points, 0)::numeric
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0)
  where l.contest_id::text = p_contest_id
    and exists (
      select 1
      from public.contest_entries ce
      where ce.contest_id::text = p_contest_id
        and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

create or replace function public.refresh_lineup_total_scores_from_golfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else coalesce(gs.total_score, g.fantasy_points, 0)::numeric
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_protection_event_atomic: credit user, debit pool, ledger, notify (single transaction)
-- ---------------------------------------------------------------------------
create or replace function public.apply_protection_event_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_lineup_id uuid,
  p_golfer_id uuid,
  p_event_type text,
  p_entry_fee numeric,
  p_contest_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_pool numeric;
  v_pc numeric;
  v_ce_id uuid;
  v_name text;
begin
  if p_event_type not in ('wd', 'dns', 'dq') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type.');
  end if;

  v_fee := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  if v_fee <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Entry fee must be positive.');
  end if;

  if exists (
    select 1
    from public.protection_events pe
    where pe.lineup_id = p_lineup_id
      and pe.golfer_id = p_golfer_id
      and pe.contest_id = p_contest_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Protection already applied for this golfer.');
  end if;

  select coalesce(c.name, 'Contest') into v_name
  from public.contests c
  where c.id::text = p_contest_id
  limit 1;

  select total_balance into v_pool from public.insurance_pool limit 1;
  if v_pool is null or v_pool < v_fee then
    return jsonb_build_object('ok', false, 'error', 'Community Protection Fund insufficient for this payout.');
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    round(coalesce(p.protection_credit_balance, 0)::numeric, 2)
  into v_pc
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  update public.profiles p
  set
    protection_credit_balance = round(v_pc + v_fee, 2),
    updated_at = now()
  where p.id = p_user_id;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    v_fee,
    'protection_credit',
    'Protection applied – WD/DNS/DQ event'
  );

  insert into public.insurance_transactions (
    contest_id,
    user_id,
    amount,
    type,
    description
  )
  values (
    p_contest_id,
    p_user_id,
    -v_fee,
    'insurance_payout',
    format('Protection payout — %s — %s', v_name, upper(p_event_type))
  );

  insert into public.protection_events (
    user_id,
    contest_id,
    lineup_id,
    golfer_id,
    event_type,
    protection_amount,
    contest_entry_id
  )
  values (
    p_user_id,
    p_contest_id,
    p_lineup_id,
    p_golfer_id,
    p_event_type,
    v_fee,
    p_contest_entry_id
  );

  update public.lineup_players lp
  set
    protection_ui_status = 'protected',
    protection_applied_at = now(),
    swap_available_until = null,
    counts_as_zero_for_scoring = true
  where lp.lineup_id = p_lineup_id
    and lp.golfer_id = p_golfer_id;

  insert into public.user_notifications (user_id, kind, title, body, metadata)
  values (
    p_user_id,
    'protection',
    'Protection Applied',
    'Your entry has been protected by the Community Protection Fund.',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'lineup_id', p_lineup_id,
      'golfer_id', p_golfer_id,
      'amount', v_fee
    )
  );

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object(
    'ok', true,
    'protection_amount', v_fee
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate protection event.');
  when others then
    raise;
end;
$$;

comment on function public.apply_protection_event_atomic is
  'Atomically credits protection_credit_balance, debits insurance pool, inserts ledgers and notification; zeros golfer score for lineup.';

-- ---------------------------------------------------------------------------
-- process_protection_engine_v1: scan protected lineup slots for a contest
-- ---------------------------------------------------------------------------
create or replace function public.process_protection_engine_v1(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_swap boolean;
  v_deadline timestamptz;
  v_status text;
  v_ev text;
  v_entry_fee numeric;
  v_ce_id uuid;
  v_res jsonb;
  n_swap int := 0;
  n_prot int := 0;
  n_skip int := 0;
begin
  for r in
    select
      lp.lineup_id,
      lp.golfer_id,
      lp.is_protected,
      lp.protection_applied_at,
      lp.protection_ui_status,
      lp.swap_available_until,
      ce.id as contest_entry_id,
      ce.user_id,
      ce.entry_fee,
      gs.playing_status,
      gs.has_teed_off,
      coalesce(g.withdrawn, false) as g_wd
    from public.lineup_players lp
    inner join public.lineups l on l.id = lp.lineup_id
    inner join public.contest_entries ce
      on ce.lineup_id = l.id
      and ce.contest_id::text = p_contest_id
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = p_contest_id
    where l.contest_id::text = p_contest_id
      and lp.is_protected = true
  loop
    if not r.is_protected then
      continue;
    end if;

    if r.protection_applied_at is not null then
      n_skip := n_skip + 1;
      continue;
    end if;

    v_status := coalesce(r.playing_status, 'not_started');
    if r.g_wd and v_status = 'not_started' then
      v_status := 'wd';
    end if;

    if coalesce(r.has_teed_off, false) = true and v_status in ('active', 'not_started') then
      update public.lineup_players lp
      set protection_ui_status = 'teed_off'
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      continue;
    end if;

    v_ev := null;
    if v_status = 'wd' or r.g_wd then
      v_ev := 'wd';
    elsif v_status = 'dns' then
      v_ev := 'dns';
    elsif v_status = 'dq' then
      v_ev := 'dq';
    end if;

    if v_ev is null then
      continue;
    end if;

    if r.protection_ui_status = 'swap_available'
       and r.swap_available_until is not null
       and r.swap_available_until > now()
       and not exists (
         select 1
         from public.protection_events pe
         where pe.lineup_id = r.lineup_id
           and pe.golfer_id = r.golfer_id
           and pe.contest_id = p_contest_id
       )
    then
      n_skip := n_skip + 1;
      continue;
    end if;

    if exists (
      select 1
      from public.protection_events pe
      where pe.lineup_id = r.lineup_id
        and pe.golfer_id = r.golfer_id
        and pe.contest_id = p_contest_id
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;

    select exists (
      select 1
      from public.golfers g2
      where not exists (
        select 1
        from public.lineup_players lp2
        where lp2.lineup_id = r.lineup_id
          and lp2.golfer_id = g2.id
      )
      and (
        not exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
        )
        or exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
            and coalesce(gs2.has_teed_off, false) = false
            and coalesce(gs2.playing_status, 'active') in ('active', 'not_started')
        )
      )
    )
    into v_swap;

    if r.swap_available_until is not null and now() >= r.swap_available_until then
      v_swap := false;
    end if;

    v_deadline := coalesce(
      (
        select min(gs3.tee_time)
        from public.golfer_scores gs3
        where gs3.contest_id = p_contest_id
          and coalesce(gs3.has_teed_off, false) = false
          and coalesce(gs3.playing_status, 'active') in ('active', 'not_started')
      ),
      now() + interval '24 hours'
    );

    if v_swap then
      update public.lineup_players lp
      set
        protection_ui_status = 'swap_available',
        swap_available_until = v_deadline
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      n_swap := n_swap + 1;
      continue;
    end if;

    v_entry_fee := round(coalesce(r.entry_fee, 0)::numeric, 2);
    v_ce_id := r.contest_entry_id;

    v_res := public.apply_protection_event_atomic(
      r.user_id,
      p_contest_id,
      r.lineup_id,
      r.golfer_id,
      v_ev,
      v_entry_fee,
      v_ce_id
    );

    if (v_res->>'ok')::boolean then
      n_prot := n_prot + 1;
    else
      n_skip := n_skip + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'swap_marked', n_swap,
    'protection_applied', n_prot,
    'skipped', n_skip
  );
end;
$$;

comment on function public.process_protection_engine_v1 is
  'Marks swap_available when replacements exist; otherwise applies protection credit atomically.';
</think>
Fixing the migration: correcting the `process_protection_engine_v1` loop (include `lineup_players` columns) and removing the erroneous note.

<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read