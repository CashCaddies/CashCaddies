-- Demo / simple scoring: assign each golfer a random fantasy_points value for leaderboard totals.

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
  return coalesce(n, 0);
end;
$$;

comment on function public.assign_random_golfer_scores() is 'Sets each golfer fantasy_points to a random value in ~[35, 95] for demo leaderboards.';

grant execute on function public.assign_random_golfer_scores() to service_role;
