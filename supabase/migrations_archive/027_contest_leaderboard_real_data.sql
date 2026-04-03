-- Mirror email on profiles for leaderboard joins (auth.users remains canonical).
alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is 'Mirror of auth.users.email for joins; keep in sync on signup/profile updates.';

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

-- Leaderboard: contest_entries â†’ lineups â†’ profiles only (no mock data path).
-- Uses lineups.total_salary (salary cap spend), lineups.total_score, profiles.email, contest_entries.protection_enabled.
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
      nullif(trim(pr.email), ''),
      (select u.email from auth.users u where u.id = ce.user_id limit 1)
    )::text as user_email,
    coalesce(l.total_salary, 0)::numeric as lineup_salary,
    ce.protection_enabled
  from public.contest_entries ce
  inner join public.lineups l on l.id = ce.lineup_id
  inner join public.profiles pr on pr.id = ce.user_id
  where ce.contest_id::text = p_contest_id
  order by l.total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'Real entries: contest_entries join lineups join profiles; order by lineups.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
