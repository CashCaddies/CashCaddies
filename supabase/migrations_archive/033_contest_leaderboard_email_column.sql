-- Align RPC output with app: expose auth email as `email` (was `user_email`).

drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  email text,
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
    nullif(trim(u.email), '')::text as email,
    coalesce(l.total_salary, 0)::numeric as total_salary,
    ce.protection_enabled
  from public.contest_entries ce
  inner join public.lineups l
    on (
      l.id = ce.lineup_id
      or (ce.lineup_id is null and l.contest_entry_id = ce.id)
    )
  inner join auth.users u on u.id = ce.user_id
  where ce.contest_id::text = p_contest_id
  order by l.total_score desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'ce â†’ l â†’ auth.users; columns include email; ORDER BY l.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
