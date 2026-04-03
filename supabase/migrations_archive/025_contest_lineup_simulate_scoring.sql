-- Leaderboard uses denormalized lineups.total_score (sum of golfer points kept via refresh, or set by simulate).

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
  order by coalesce(l.total_score, 0) desc nulls last, l.id;
$$;

comment on function public.contest_leaderboard(text) is
  'Entries for a contest; total_score from lineups.total_score; sorted by score desc.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;

-- Dev/testing: random total_score on each lineup entered in this contest (no golfer table updates).
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
  where l.id in (
    select ce.lineup_id
    from public.contest_entries ce
    where ce.contest_id::text = p_contest_id
  );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_contest_lineup_scores(text) is
  'Sets random lineups.total_score for all lineups with a contest_entry in p_contest_id.';

grant execute on function public.simulate_contest_lineup_scores(text) to anon, authenticated;

-- Optional: random total_score on every lineup (e.g. Admin â†’ Simulate scoring without a contest id).
drop function if exists public.simulate_all_lineup_scores() cascade;
create or replace function public.simulate_all_lineup_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups
  set total_score = round((150 + random() * 200)::numeric, 1);
  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_all_lineup_scores() is 'Sets random lineups.total_score on all lineups.';

grant execute on function public.simulate_all_lineup_scores() to anon, authenticated;
