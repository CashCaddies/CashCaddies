-- Re-apply enter_contest_atomic with start_time lock (idempotent for DBs that already ran 20260421382000).

create or replace function public.enter_contest_atomic(
  p_user_id uuid,
  p_contest_id uuid,
  p_lineup jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_c public.contests;
  v_lineup_id uuid;
  v_fee numeric;
  v_user_entries int;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null or p_contest_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_arguments');
  end if;

  v_lineup_id := nullif(trim(coalesce(p_lineup ->> 'lineup_id', '')), '')::uuid;
  if v_lineup_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_lineup_id',
      'message', 'Use p_lineup = jsonb_build_object(''lineup_id'', <saved lineups.id>). Roster JSON is created via lineups + lineup_players in the app first.'
    );
  end if;

  select *
  into v_c
  from public.contests c
  where c.id = p_contest_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'contest_not_found');
  end if;

  if now() >= v_c.start_time then
    raise exception 'Contest locked';
  end if;

  if lower(trim(coalesce(v_c.status, ''))) is distinct from 'filling' then
    return jsonb_build_object('ok', false, 'error', 'contest_not_open', 'status', v_c.status);
  end if;

  if coalesce(v_c.current_entries, 0) >= coalesce(v_c.max_entries, 1) then
    return jsonb_build_object('ok', false, 'error', 'contest_full');
  end if;

  select count(*)::int
  into v_user_entries
  from public.contest_entries ce
  where ce.user_id = p_user_id
    and ce.contest_id = p_contest_id;

  if v_user_entries >= greatest(1, coalesce(v_c.max_entries_per_user, 1)) then
    return jsonb_build_object('ok', false, 'error', 'entry_limit_reached');
  end if;

  v_fee := greatest(
    0,
    round(
      case
        when v_c.entry_fee_cents is not null then v_c.entry_fee_cents::numeric / 100.0
        else coalesce(v_c.entry_fee_usd, v_c.entry_fee, 0)::numeric
      end,
      2
    )
  );

  return public.create_contest_entry_atomic(
    p_user_id,
    p_contest_id::text,
    v_fee,
    0::numeric,
    v_fee,
    false,
    v_lineup_id,
    coalesce(nullif(trim(v_c.name), ''), 'Contest')
  );
end;
$$;

comment on function public.enter_contest_atomic(uuid, uuid, jsonb) is
  'Lobby entry: expects p_lineup.lineup_id; delegates to create_contest_entry_atomic (wallet + contest_entries).';

revoke all on function public.enter_contest_atomic(uuid, uuid, jsonb) from public;

grant execute on function public.enter_contest_atomic(uuid, uuid, jsonb) to authenticated;
grant execute on function public.enter_contest_atomic(uuid, uuid, jsonb) to service_role;
