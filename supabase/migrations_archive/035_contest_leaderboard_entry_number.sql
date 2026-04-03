-- entry_number: per user within the contest (1 = first contest_entry by created_at).

drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  email text,
  total_salary numeric,
  protection_enabled boolean,
  entry_number integer
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    q.lineup_id,
    q.user_id,
    q.total_score,
    q.email,
    q.total_salary,
    q.protection_enabled,
    q.entry_number
  from (
    select
      l.id as lineup_id,
      ce.user_id,
      coalesce(l.total_score, 0)::numeric as total_score,
      nullif(trim(u.email), '')::text as email,
      coalesce(l.total_salary, 0)::numeric as total_salary,
      ce.protection_enabled,
      row_number() over (
        partition by ce.user_id
        order by ce.created_at asc, ce.id asc
      )::integer as entry_number
    from public.contest_entries ce
    inner join public.lineups l
      on (
        l.id = ce.lineup_id
        or (ce.lineup_id is null and l.contest_entry_id = ce.id)
      )
    inner join auth.users u on u.id = ce.user_id
    where ce.contest_id::text = p_contest_id
  ) q
  order by q.total_score desc nulls last, q.lineup_id;
$$;

comment on function public.contest_leaderboard(text) is
  'Leaderboard rows with email, entry_number per user in contest; ORDER BY total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
