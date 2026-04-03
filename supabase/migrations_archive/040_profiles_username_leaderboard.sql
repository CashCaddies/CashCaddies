-- Public handle for display (leaderboard). Backfill from email local-part; disambiguate duplicates.

alter table public.profiles
  add column if not exists username text;

comment on column public.profiles.username is 'Unique public handle; leaderboard display (fallback from email prefix).';

with ranked as (
  select
    id,
    case
      when coalesce(trim(email), '') = '' then null
      else left(split_part(lower(trim(email)), '@', 1), 50)
    end as base,
    row_number() over (
      partition by case
        when coalesce(trim(email), '') = '' then id::text
        else left(split_part(lower(trim(email)), '@', 1), 50)
      end
      order by id asc
    ) as rn
  from public.profiles
),
computed as (
  select
    id,
    case
      when base is null or base = '' then null
      when rn = 1 then base
      else left(base, 40) || '_' || rn::text
    end as u
  from ranked
)
update public.profiles p
set username = c.u
from computed c
where p.id = c.id
  and p.username is null;

create unique index if not exists profiles_username_unique
  on public.profiles (username)
  where username is not null;

-- Leaderboard RPC: expose profiles.username + profiles.email for app fallbacks.
drop function if exists public.contest_leaderboard(text) cascade;
create or replace function public.contest_leaderboard(p_contest_id text)
returns table (
  lineup_id uuid,
  user_id uuid,
  total_score numeric,
  username text,
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
    q.username,
    q.email,
    q.total_salary,
    q.protection_enabled,
    q.entry_number
  from (
    select
      l.id as lineup_id,
      ce.user_id,
      coalesce(l.total_score, 0)::numeric as total_score,
      nullif(trim(p.username), '')::text as username,
      nullif(trim(p.email), '')::text as email,
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
    inner join public.profiles p on p.id = ce.user_id
    where ce.contest_id::text = p_contest_id
  ) q
  order by q.total_score desc nulls last, q.lineup_id;
$$;

comment on function public.contest_leaderboard(text) is
  'Leaderboard: profiles.username + email, entry_number; ORDER BY total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
