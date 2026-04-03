-- Leaderboard from contest_entries + lineups + profiles; email from auth.users (security definer).

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
    coalesce(sum(g.fantasy_points), 0)::numeric as total_score,
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
  group by l.id, ce.user_id, l.total_salary, ce.protection_enabled, ce.id
  order by total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'Entries for a contest: joined contest_entries, lineups, profiles; score = sum of golfer fantasy_points; sorted by score desc.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
