-- Leaderboard + simulate: include lineups linked via ce.lineup_id OR lineups.contest_entry_id = ce.id
-- (submitLineup flow sets contest_entry_id on lineups before lineup_id on contest_entries is guaranteed in edge cases).

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
  'ce â†’ l (lineup_id or contest_entry_id) â†’ auth.users; ORDER BY l.total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;

drop function if exists public.simulate_contest_lineup_scores(text) cascade;
create or replace function public.simulate_contest_lineup_scores(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = round((150 + random() * 200)::numeric, 1)
  where exists (
    select 1
    from public.contest_entries ce
    where ce.contest_id::text = p_contest_id
      and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
  );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_contest_lineup_scores(text) is
  'Random lineups.total_score for lineups tied to contest_entries for p_contest_id (either FK direction).';

grant execute on function public.simulate_contest_lineup_scores(text) to anon, authenticated;
