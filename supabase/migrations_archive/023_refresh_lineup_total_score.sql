-- Denormalized lineups.total_score = sum of golfers.fantasy_points on that lineup (via lineup_players).

drop function if exists public.refresh_lineup_total_scores_from_golfers() cascade;
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
    select sum(g.fantasy_points)::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    where lp.lineup_id = l.id
  ), 0);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.refresh_lineup_total_scores_from_golfers() is
  'Sets each lineups.total_score to the sum of fantasy_points for golfers rostered on that lineup.';

grant execute on function public.refresh_lineup_total_scores_from_golfers() to service_role;

-- Random demo scores: also refresh lineup aggregates so lineups.total_score stays in sync.
drop function if exists public.assign_random_golfer_scores() cascade;
create or replace function public.assign_random_golfer_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.golfers
  set fantasy_points = round((35 + random() * 60)::numeric, 1);
  get diagnostics n = row_count;
  perform public.refresh_lineup_total_scores_from_golfers();
  return coalesce(n, 0);
end;
$$;
