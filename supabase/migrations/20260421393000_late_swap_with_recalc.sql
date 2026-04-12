-- Wrapper: resolve contest from entry, then existing score refresh (baseline: refresh_lineup_total_scores_for_contest).
-- There is no recalculate_entry_score in baseline; this migration adds it as the stable name for callers.

create or replace function public.recalculate_entry_score(p_entry_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path to public
as $$
declare
  v_cid text;
begin
  select trim(ce.contest_id::text)
  into v_cid
  from public.contest_entries ce
  where ce.id = p_entry_id;

  if v_cid is null or v_cid = '' then
    return;
  end if;

  perform public.refresh_lineup_total_scores_for_contest(v_cid);
end;
$$;

comment on function public.recalculate_entry_score(uuid) is
  'Looks up contest_entries.contest_id and runs refresh_lineup_total_scores_for_contest (lineup totals from golfer_scores).';

grant execute on function public.recalculate_entry_score(uuid) to anon, authenticated, service_role;

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
  v_result := public.late_swap_player(p_entry_id, p_user_id, p_out_player, p_in_player);

  if coalesce((v_result->>'ok')::boolean, false) is distinct from true then
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
  'late_swap_player then recalculate_entry_score (contest-wide lineup total_score refresh).';

revoke all on function public.late_swap_with_recalc(uuid, uuid, uuid, uuid) from public;

grant execute on function public.late_swap_with_recalc(uuid, uuid, uuid, uuid) to authenticated, service_role;
