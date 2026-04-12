-- Rank by cumulative strokes (lower better). sim_live_state has strokes, not total_score.

create or replace function public.get_player_rank(p_player_id uuid)
returns integer
language sql
security definer
set search_path to public
as $$
  select rnk::integer
  from (
    select
      player_id,
      rank() over (order by strokes asc, player_id asc) as rnk
    from public.sim_live_state
  ) t
  where player_id = p_player_id;
$$;

comment on function public.get_player_rank(uuid) is
  'Stroke rank among sim_live_state rows (rank() ties); null if player_id not found.';

revoke all on function public.get_player_rank(uuid) from public;

grant execute on function public.get_player_rank(uuid) to anon;
grant execute on function public.get_player_rank(uuid) to authenticated;
grant execute on function public.get_player_rank(uuid) to service_role;
