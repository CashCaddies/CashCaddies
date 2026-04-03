-- Fantasy points per golfer (admin-updated). Used with lineup_players for contest leaderboards.

alter table public.golfers
  add column if not exists fantasy_points numeric not null default 0;

comment on column public.golfers.fantasy_points is 'Cumulative fantasy points from simple B/P/Bg scoring; summed per lineup for leaderboards.';

-- One row per lineup in a contest: total fantasy points = sum of golfer fantasy_points.
drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  golfer_count bigint,
  user_email text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    l.id as lineup_id,
    l.user_id,
    coalesce(sum(g.fantasy_points), 0)::numeric as total_score,
    count(lp.id)::bigint as golfer_count,
    (select u.email from auth.users u where u.id = l.user_id limit 1) as user_email
  from public.lineups l
  inner join public.lineup_players lp on lp.lineup_id = l.id
  inner join public.golfers g on g.id = lp.golfer_id
  where l.contest_id::text = p_contest_id
  group by l.id, l.user_id
  order by total_score desc nulls last, lineup_id;
$$;

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
