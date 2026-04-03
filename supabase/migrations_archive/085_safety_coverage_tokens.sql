-- Safety Coverage Token model: ledger tokens (pre–Round-1 WD/DNS/DQ), finish-only strip (post–tee WD/DQ).

-- ---------------------------------------------------------------------------
-- golfer_scores: optional finish-position bonus (separate from DFS performance)
-- ---------------------------------------------------------------------------
alter table public.golfer_scores
  add column if not exists finish_position_points numeric not null default 0
    constraint golfer_scores_finish_position_points_check check (finish_position_points >= 0);

comment on column public.golfer_scores.finish_position_points is
  'Tournament finish / placement bonus points; excluded for post–Round-1 WD/DQ when lineup_players.exclude_finish_position_points is true.';

-- ---------------------------------------------------------------------------
-- lineup_players: post–Round-1 WD/DQ — keep DFS performance, drop finish points only
-- ---------------------------------------------------------------------------
alter table public.lineup_players
  add column if not exists exclude_finish_position_points boolean not null default false;

comment on column public.lineup_players.exclude_finish_position_points is
  'When true, this golfer contributes golfer_scores.total_score (DFS) only toward lineup total (no finish_position_points).';

-- ---------------------------------------------------------------------------
-- contest_entries: token issuance flag
-- ---------------------------------------------------------------------------
alter table public.contest_entries
  add column if not exists protection_token_issued boolean not null default false;

comment on column public.contest_entries.protection_token_issued is
  'True when a Safety Coverage Token was issued for this entry (pre–Round-1 WD/DNS/DQ).';

-- ---------------------------------------------------------------------------
-- safety_tokens: one row per contest entry max (unique on contest_entry_id)
-- ---------------------------------------------------------------------------
create table if not exists public.safety_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null references public.contests (id) on delete cascade,
  contest_entry_id uuid not null references public.contest_entries (id) on delete cascade,
  golfer_id uuid references public.golfers (id) on delete set null,
  token_value numeric not null check (token_value >= 0),
  status text not null default 'active',
  issued_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint safety_tokens_contest_entry_id_key unique (contest_entry_id),
  constraint safety_tokens_status_check check (status in ('active', 'redeemed', 'expired', 'void'))
);

create index if not exists safety_tokens_user_created_idx
  on public.safety_tokens (user_id, created_at desc);

comment on table public.safety_tokens is
  'Safety Coverage Token ledger: pre–Round-1 WD/DNS/DQ; token_value typically equals contest entry fee.';

alter table public.safety_tokens enable row level security;

drop policy if exists "Users select own safety_tokens" on public.safety_tokens;
create policy "Users select own safety_tokens"
  on public.safety_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.safety_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- Scoring: DFS + optional finish; protected slot = 0; exclude_finish strips finish only
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
            else
              coalesce(gs.total_score, g.fantasy_points, 0)::numeric
              + case
                  when coalesce(lp.exclude_finish_position_points, false) then 0::numeric
                  else coalesce(gs.finish_position_points, 0)::numeric
                end
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
            else
              coalesce(gs.total_score, g.fantasy_points, 0)::numeric
              + case
                  when coalesce(lp.exclude_finish_position_points, false) then 0::numeric
                  else coalesce(gs.finish_position_points, 0)::numeric
                end
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
-- apply_protection_event_atomic: token path (pre–tee) vs post–tee scoring strip
-- ---------------------------------------------------------------------------
drop function if exists public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) cascade;

create or replace function public.apply_protection_event_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_lineup_id uuid,
  p_golfer_id uuid,
  p_event_type text,
  p_entry_fee numeric,
  p_contest_entry_id uuid,
  p_issue_safety_token boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_name text;
  v_golfer_name text;
  v_issued_reason text;
  v_body text;
begin
  if p_event_type not in ('wd', 'dns', 'dq') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type.');
  end if;

  v_fee := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);

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

  select coalesce(g.name, 'Golfer') into v_golfer_name
  from public.golfers g
  where g.id = p_golfer_id;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  v_issued_reason := case p_event_type
    when 'wd' then 'WD protection'
    when 'dns' then 'DNS protection'
    else 'DQ protection'
  end;

  if p_issue_safety_token then
    if exists (
      select 1 from public.safety_tokens st where st.contest_entry_id = p_contest_entry_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'Safety token already issued for this entry.');
    end if;

    insert into public.safety_tokens (
      user_id,
      contest_id,
      contest_entry_id,
      golfer_id,
      token_value,
      status,
      issued_reason,
      expires_at
    )
    values (
      p_user_id,
      p_contest_id,
      p_contest_entry_id,
      p_golfer_id,
      v_fee,
      'active',
      v_issued_reason,
      null
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
      protection_token_issued = true,
      protected_golfer_id = p_golfer_id,
      protection_reason = upper(p_event_type)
    where ce.id = p_contest_entry_id;

    update public.lineup_players lp
    set
      protection_ui_status = 'protected',
      protection_applied_at = now(),
      swap_available_until = null,
      counts_as_zero_for_scoring = true,
      exclude_finish_position_points = false
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_golfer_id;

    v_body :=
      E'Safety Coverage Activated\n\nGolfer:\n'
      || v_golfer_name
      || E'\n\nToken Issued:\n$'
      || trim(to_char(v_fee, 'FM999999990.00'))
      || E'\n';

    insert into public.user_notifications (user_id, kind, title, body, metadata)
    values (
      p_user_id,
      'safety_coverage_activated',
      'Safety Coverage Activated',
      v_body,
      jsonb_build_object(
        'contest_id', p_contest_id,
        'lineup_id', p_lineup_id,
        'golfer_id', p_golfer_id,
        'golfer_name', v_golfer_name,
        'token_amount', v_fee,
        'reason', upper(p_event_type)
      )
    );
  else
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
      0,
      p_contest_entry_id
    );

    update public.contest_entries ce
    set
      protection_triggered = true,
      protection_token_issued = false,
      protected_golfer_id = p_golfer_id,
      protection_reason = upper(p_event_type) || '_POST_R1'
    where ce.id = p_contest_entry_id;

    update public.lineup_players lp
    set
      protection_ui_status = coalesce(lp.protection_ui_status, 'teed_off'),
      exclude_finish_position_points = true,
      counts_as_zero_for_scoring = false
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_golfer_id;
  end if;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object(
    'ok', true,
    'protection_amount', case when p_issue_safety_token then v_fee else 0::numeric end,
    'safety_token_issued', p_issue_safety_token
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate protection event.');
  when others then
    raise;
end;
$$;

comment on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid, boolean) is
  'Pre–Round-1 tee: issue Safety Coverage Token + zero slot DFS+finish; post–tee WD/DQ: strip finish_position_points only.';

grant execute on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- process_protection_engine_v1: branch on has_teed_off (Round-1 tee proxy)
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
  v_issue_token boolean;
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

    v_issue_token := coalesce(r.has_teed_off, false) = false;

    v_entry_fee := round(coalesce(r.entry_fee, 0)::numeric, 2);
    v_ce_id := r.contest_entry_id;

    v_res := public.apply_protection_event_atomic(
      r.user_id,
      p_contest_id,
      r.lineup_id,
      r.golfer_id,
      v_ev,
      v_entry_fee,
      v_ce_id,
      v_issue_token
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
  'WD/DNS/DQ: pre–Round-1 tee (has_teed_off false) issues Safety Coverage Token; post–tee strips finish points only.';
