-- FINAL SWAP FUNCTION (PRODUCTION SAFE): delegates to late_swap_player (locks + validate_late_swap + validate_lineup_rules), then recalculate_entry_score.
-- Uses (v_result->>'ok') is distinct from 'true' so missing/invalid ok does not fall through to recalc.

create or replace function public.late_swap_with_recalc(
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
  v_result jsonb;
begin
  select public.late_swap_player(
    p_entry_id,
    p_user_id,
    p_out_player,
    p_in_player
  )
  into v_result;

  if (v_result->>'ok') is distinct from 'true' then
    return v_result;
  end if;

  perform public.recalculate_entry_score(p_entry_id);

  return jsonb_build_object(
    'ok', true,
    'lineup', v_result->'new_lineup'
  );
end;
$$;

comment on function public.late_swap_with_recalc(uuid, uuid, uuid, uuid) is
  'late_swap_player (full validation) then recalculate_entry_score (contest-wide lineup total_score refresh).';

revoke all on function public.late_swap_with_recalc(uuid, uuid, uuid, uuid) from public;

grant execute on function public.late_swap_with_recalc(uuid, uuid, uuid, uuid) to authenticated, service_role;
