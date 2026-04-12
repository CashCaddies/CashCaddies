-- Atomic late swap: roster lives in lineup_players (golfer_id), keyed by contest_entries.lineup_id — not a uuid[] on contest_entries.
-- is_golfer_locked + validate_late_swap updated so DFS golfer ids (golfers.game_start_at) are enforced alongside public.players.

create or replace function public.is_golfer_locked(p_golfer_id uuid)
returns boolean
language plpgsql
stable
set search_path to public
as $$
declare
  v_start_time timestamptz;
begin
  select g.game_start_at
  into v_start_time
  from public.golfers g
  where g.id = p_golfer_id;

  if v_start_time is null then
    return false;
  end if;

  return now() >= v_start_time;
end;
$$;

comment on function public.is_golfer_locked(uuid) is
  'True when golfers.game_start_at is set and now() is past that instant.';

grant execute on function public.is_golfer_locked(uuid) to anon, authenticated, service_role;

create or replace function public.validate_late_swap(
  p_entry_id uuid,
  p_out_player uuid,
  p_in_player uuid
)
returns jsonb
language plpgsql
stable
set search_path to public
as $$
declare
  v_out_locked boolean;
  v_in_locked boolean;
begin
  v_out_locked :=
    public.is_player_locked(p_out_player)
    or public.is_golfer_locked(p_out_player);
  if v_out_locked then
    return jsonb_build_object(
      'ok', false,
      'error', 'OUT_PLAYER_LOCKED'
    );
  end if;

  v_in_locked :=
    public.is_player_locked(p_in_player)
    or public.is_golfer_locked(p_in_player);
  if v_in_locked then
    return jsonb_build_object(
      'ok', false,
      'error', 'IN_PLAYER_LOCKED'
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.late_swap_player(
  p_entry_id uuid,
  p_user_id uuid,
  p_out_player uuid,
  p_in_player uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  v_lineup_id uuid;
  v_lp_id uuid;
  v_validation jsonb;
  v_new_lineup jsonb;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  select ce.lineup_id
  into v_lineup_id
  from public.contest_entries ce
  where ce.id = p_entry_id
    and ce.user_id = p_user_id
  for update;

  if v_lineup_id is null then
    return jsonb_build_object('ok', false, 'error', 'ENTRY_NOT_FOUND');
  end if;

  perform 1
  from public.lineups l
  where l.id = v_lineup_id
  for update;

  v_validation := public.validate_late_swap(p_entry_id, p_out_player, p_in_player);
  if coalesce((v_validation->>'ok')::boolean, false) is distinct from true then
    return v_validation;
  end if;

  if p_out_player is not distinct from p_in_player then
    return jsonb_build_object('ok', false, 'error', 'SAME_PLAYER');
  end if;

  if exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = v_lineup_id
      and lp.golfer_id = p_in_player
      and lp.golfer_id is distinct from p_out_player
  ) then
    return jsonb_build_object('ok', false, 'error', 'IN_PLAYER_ALREADY_IN_LINEUP');
  end if;

  select lp.id
  into v_lp_id
  from public.lineup_players lp
  where lp.lineup_id = v_lineup_id
    and lp.golfer_id = p_out_player
  for update;

  if v_lp_id is null then
    return jsonb_build_object('ok', false, 'error', 'PLAYER_NOT_IN_LINEUP');
  end if;

  update public.lineup_players lp
  set golfer_id = p_in_player
  where lp.id = v_lp_id;

  select coalesce(
    (
      select jsonb_agg(lp2.golfer_id order by lp2.slot_index, lp2.id)
      from public.lineup_players lp2
      where lp2.lineup_id = v_lineup_id
    ),
    '[]'::jsonb
  )
  into v_new_lineup;

  return jsonb_build_object(
    'ok', true,
    'new_lineup', v_new_lineup
  );
end;
$$;

comment on function public.late_swap_player(uuid, uuid, uuid, uuid) is
  'Locks contest entry + lineup; validates swap; replaces golfer on lineup_players; returns ordered golfer id jsonb array.';

revoke all on function public.late_swap_player(uuid, uuid, uuid, uuid) from public;

grant execute on function public.late_swap_player(uuid, uuid, uuid, uuid) to authenticated, service_role;
