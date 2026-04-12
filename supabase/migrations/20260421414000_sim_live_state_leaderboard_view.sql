-- Leaderboard-shaped read model: strokes as total_score, round derived from cumulative hole (18 holes / round).

create or replace view public.sim_live_state_leaderboard as
select
  sls.player_id,
  sp.name as player_name,
  sls.strokes as total_score,
  case
    when sls.hole <= 0 then 0
    else (sls.hole - 1) / 18 + 1
  end as "round",
  sls.hole,
  case
    when sls.made_cut is true then 'MADE CUT'
    when sls.is_cut is true then 'CUT'
    else ''
  end as cut_status
from public.sim_live_state sls
left join public.sim_players sp on sp.id = sls.player_id;

comment on view public.sim_live_state_leaderboard is
  'Live sim standings: total_score = strokes (lower better); round = floor after R0 from cumulative hole; requires made_cut/is_cut columns.';

grant select on public.sim_live_state_leaderboard to anon;
grant select on public.sim_live_state_leaderboard to authenticated;
