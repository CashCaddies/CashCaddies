-- Automatic lineup protection: remove manual insured_golfer_id; track triggered protection on contest_entries.

alter table public.user_notifications
  add column if not exists email_sent_at timestamptz;

comment on column public.user_notifications.email_sent_at is
  'When set, optional outbound email for this notification was sent (server-side).';

-- Drop manual insured-golfer requirement (migration 081 wrapper + trigger).
drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text, uuid) cascade;

drop trigger if exists enforce_contest_entry_insured_golfer on public.contest_entries;
drop function if exists public.enforce_contest_entry_insured_golfer() cascade;

-- contests_with_stats (082) references contest_entries.insured_golfer_id; must drop before column removal. Recreated in 084.
drop view if exists public.contests_with_stats cascade;

alter table public.contest_entries
  drop column if exists insured_golfer_id;

alter table public.contest_entries
  add column if not exists protection_triggered boolean not null default false,
  add column if not exists protected_golfer_id uuid references public.golfers (id) on delete set null,
  add column if not exists protection_reason text;

comment on column public.contest_entries.protection_triggered is
  'True after automatic CashCaddies protection applied (WD/DNS/DQ on a roster golfer).';

comment on column public.contest_entries.protected_golfer_id is
  'Golfer whose WD/DNS/DQ triggered automatic protection for this entry.';

comment on column public.contest_entries.protection_reason is
  'Trigger reason: WD, DNS, or DQ.';

-- apply_protection_event_atomic: set contest_entries + notification kind protection_activated
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

  update public.contest_entries ce
  set
    protection_triggered = true,
    protected_golfer_id = p_golfer_id,
    protection_reason = upper(p_event_type)
  where ce.id = p_contest_entry_id;

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
    'protection_activated',
    'Protection Activated',
    'Your lineup was automatically protected because a golfer withdrew, was disqualified, or did not start.',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'lineup_id', p_lineup_id,
      'golfer_id', p_golfer_id,
      'amount', v_fee,
      'reason', upper(p_event_type)
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
  'Automatic lineup protection: credit user, update contest_entries, notify (protection_activated).';

-- process_protection_engine_v1: evaluate all roster golfers (not only is_protected)
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
  loop
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
  'WD/DNS/DQ on any roster golfer: swap window or automatic lineup protection (all roster slots).';
