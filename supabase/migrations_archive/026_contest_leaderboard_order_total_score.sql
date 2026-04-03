-- Leaderboard: explicit ORDER BY lineups.total_score DESC (tie-breaker: lineup id).

drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  golfer_count bigint,
  user_email text,
  lineup_salary numeric,
  protection_enabled boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    l.id as lineup_id,
    ce.user_id,
    coalesce(l.total_score, 0)::numeric as total_score,
    count(lp.id)::bigint as golfer_count,
    (select u.email from auth.users u where u.id = ce.user_id limit 1) as user_email,
    coalesce(l.total_salary, 0)::numeric as lineup_salary,
    ce.protection_enabled
  from public.contest_entries ce
  inner join public.lineups l on l.id = ce.lineup_id
  inner join public.profiles pr on pr.id = ce.user_id
  inner join public.lineup_players lp on lp.lineup_id = l.id
  inner join public.golfers g on g.id = lp.golfer_id
  where ce.contest_id::text = p_contest_id
  group by l.id, ce.user_id, l.total_salary, l.total_score, ce.protection_enabled, ce.id
  order by l.total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'Entries for a contest; total_score from lineups.total_score; ORDER BY lineups.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
