-- Ensure every profile has a temp handle user_<6 hex of id> so leaderboards never need Entry # for identity.
-- Idempotent: only fills NULL usernames; re-applies contest_leaderboard RPC with profiles.username.

drop function if exists public.generate_temp_profile_username(uuid) cascade;
create or replace function public.generate_temp_profile_username(p_id uuid)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  hex_full text := lower(replace(p_id::text, '-', ''));
  base text := 'user_' || substr(hex_full, 1, 6);
  cand text := base;
  n int := 1;
begin
  while exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(cand)
      and p.id is distinct from p_id
  ) loop
    n := n + 1;
    cand := left(base, 16) || n::text;
    if length(cand) > 20 then
      cand := 'user_' || left(hex_full, 15);
    end if;
    exit when n > 500;
  end loop;
  return cand;
end;
$$;

alter table public.profiles
  add column if not exists username text;

-- Fill any rows still missing a username (e.g. created before triggers / partial migrations).
update public.profiles p
set username = public.generate_temp_profile_username(p.id)
where p.username is null
   or trim(p.username) = '';

-- Enforce NOT NULL when column exists
alter table public.profiles
  alter column username set not null;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

-- Leaderboard: always expose profiles.username (and email for admin/debug only).
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
  'Leaderboard: profiles.username + email; ORDER BY total_score DESC.';

grant execute on function public.contest_leaderboard(text) to anon, authenticated;
