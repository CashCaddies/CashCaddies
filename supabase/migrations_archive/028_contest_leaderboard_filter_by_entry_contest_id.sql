-- Leaderboard: filter by contest_entries.contest_id only â€” not lineups.contest_id.
-- Join order: contest_entries ce -> lineups l on l.id = ce.lineup_id -> profiles p on p.id = ce.user_id.
-- Order: l.total_score DESC.

drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
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
    coalesce(
      nullif(trim(p.email), ''),
      (select u.email from auth.users u where u.id = ce.user_id limit 1)
    )::text as user_email,
    coalesce(l.total_salary, 0)::numeric as lineup_salary,
    ce.protection_enabled
  from public.contest_entries ce
  inner join public.lineups l on l.id = ce.lineup_id
  inner join public.profiles p on p.id = ce.user_id
  where ce.contest_id::text = p_contest_id
  order by l.total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'ce -> l -> p; WHERE ce.contest_id::text = p_contest_id; ORDER BY l.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
