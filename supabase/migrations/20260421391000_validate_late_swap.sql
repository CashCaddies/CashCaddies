-- Late-swap validation: both roster spots must reference unlocked players (public.players + is_player_locked).
-- p_entry_id reserved for callers / future rules (contest window, roster membership).

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
  v_out_locked := public.is_player_locked(p_out_player);
  if v_out_locked then
    return jsonb_build_object(
      'ok', false,
      'error', 'OUT_PLAYER_LOCKED'
    );
  end if;

  v_in_locked := public.is_player_locked(p_in_player);
  if v_in_locked then
    return jsonb_build_object(
      'ok', false,
      'error', 'IN_PLAYER_LOCKED'
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.validate_late_swap(uuid, uuid, uuid) is
  'Returns ok:false when outgoing or incoming player is past game_start_at (is_player_locked).';

grant execute on function public.validate_late_swap(uuid, uuid, uuid) to anon, authenticated, service_role;
