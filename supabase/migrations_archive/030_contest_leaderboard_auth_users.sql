-- Leaderboard: contest_entries â†’ lineups â†’ auth.users (email from auth.users only).

drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  user_email text,
  total_salary numeric,
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
    nullif(trim(u.email), '')::text as user_email,
    coalesce(l.total_salary, 0)::numeric as total_salary,
    ce.protection_enabled
  from public.contest_entries ce
  inner join public.lineups l on l.id = ce.lineup_id
  inner join auth.users u on u.id = ce.user_id
  where ce.contest_id::text = p_contest_id
  order by l.total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'ce â†’ l â†’ u (auth.users); u.email, l.total_score, l.total_salary, ce.protection_enabled; ce.contest_id = p; ORDER BY l.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
