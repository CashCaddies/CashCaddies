-- Swap a protected golfer when engine marked swap_available (replacement not yet teed off).

create or replace function public.swap_protected_lineup_golfer_atomic(
  p_user_id uuid,
  p_lineup_id uuid,
  p_old_golfer_id uuid,
  p_new_golfer_id uuid,
  p_contest_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l record;
  v_old_salary int;
  v_new_salary int;
  v_new_total int;
  v_cap int := 50000;
  v_eligible boolean;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  if p_old_golfer_id = p_new_golfer_id then
    return jsonb_build_object('ok', false, 'error', 'Choose a different golfer.');
  end if;

  select l.id, l.user_id, l.contest_id, l.contest_entry_id, l.total_salary
  into v_l
  from public.lineups l
  where l.id = p_lineup_id
    and l.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lineup not found.');
  end if;

  if v_l.contest_id is null or v_l.contest_id::text <> p_contest_id then
    return jsonb_build_object('ok', false, 'error', 'Contest mismatch.');
  end if;

  if v_l.contest_entry_id is null then
    return jsonb_build_object('ok', false, 'error', 'Lineup not entered.');
  end if;

  if not exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_old_golfer_id
      and lp.protection_ui_status = 'swap_available'
      and lp.protection_applied_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'Swap is not available for this golfer.');
  end if;

  if exists (
    select 1
    from public.lineup_players lp2
    where lp2.lineup_id = p_lineup_id
      and lp2.golfer_id = p_new_golfer_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Golfer already in lineup.');
  end if;

  select g.salary::int into v_old_salary from public.golfers g where g.id = p_old_golfer_id;
  select g.salary::int into v_new_salary from public.golfers g where g.id = p_new_golfer_id;

  if v_old_salary is null or v_new_salary is null then
    return jsonb_build_object('ok', false, 'error', 'Golfer not found.');
  end if;

  v_new_total := v_l.total_salary - v_old_salary + v_new_salary;
  if v_new_total > v_cap then
    return jsonb_build_object('ok', false, 'error', 'Salary cap exceeded.');
  end if;

  select exists (
    select 1
    from public.golfers g2
    where g2.id = p_new_golfer_id
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
  into v_eligible;

  if not v_eligible then
    return jsonb_build_object(
      'ok', false,
      'error', 'Replacement golfer is not eligible (may have teed off).'
    );
  end if;

  update public.lineup_players lp
  set
    golfer_id = p_new_golfer_id,
    protection_ui_status = null,
    swap_available_until = null,
    counts_as_zero_for_scoring = false
  where lp.lineup_id = p_lineup_id
    and lp.golfer_id = p_old_golfer_id;

  update public.lineups l
  set total_salary = v_new_total
  where l.id = p_lineup_id;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Could not swap golfer (duplicate slot).');
  when others then
    raise;
end;
$$;

comment on function public.swap_protected_lineup_golfer_atomic is
  'Replaces a WD/DNS/DQ golfer when swap_available; enforces salary cap and tee-time eligibility.';

grant execute on function public.swap_protected_lineup_golfer_atomic(uuid, uuid, uuid, uuid, text) to authenticated;

grant execute on function public.process_protection_engine_v1(text) to service_role;
grant execute on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) to service_role;
