-- DFS handle: unique lowercase username (3–20, [a-z0-9_]). No email-based defaults.
-- Existing rows: user_<first 6 hex chars of id>, with numeric suffix if duplicate.
-- New rows: BEFORE INSERT assigns temp username when omitted.

alter table public.profiles
  add column if not exists username text;

drop index if exists public.profiles_username_unique;

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

-- Backfill / normalize: everyone gets user_<6hex> (suffix if clash).
with hex as (
  select id, lower(replace(id::text, '-', '')) as nh
  from public.profiles
),
ranked as (
  select
    id,
    'user_' || substr(nh, 1, 6) as base,
    row_number() over (
      partition by substr(nh, 1, 6)
      order by id asc
    ) as rn
  from hex
),
computed as (
  select
    id,
    case
      when rn = 1 then base
      else left(base, 16) || rn::text
    end as u
  from ranked
)
update public.profiles p
set username = c.u
from computed c
where p.id = c.id;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

comment on column public.profiles.username is
  'Unique DFS handle (lowercase a-z 0-9 _). Temp default user_<6hex> until user sets a custom name.';

drop trigger if exists profiles_username_before_insert on public.profiles;
drop function if exists public.profiles_username_before_insert();

create or replace function public.profiles_username_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.username is null or btrim(new.username::text) = '' then
    new.username := public.generate_temp_profile_username(new.id);
  else
    new.username := lower(btrim(new.username::text));
  end if;

  if new.username is null or new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'profiles.username must be 3–20 characters: lowercase letters, digits, underscore only';
  end if;

  return new;
end;
$$;

create trigger profiles_username_before_insert
  before insert on public.profiles
  for each row
  execute function public.profiles_username_before_insert();

drop trigger if exists profiles_username_before_update on public.profiles;
drop function if exists public.profiles_username_before_update();

create or replace function public.profiles_username_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.username := lower(btrim(coalesce(new.username, old.username)::text));

  if new.username is null or new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'profiles.username must be 3–20 characters: lowercase letters, digits, underscore only';
  end if;

  return new;
end;
$$;

create trigger profiles_username_before_update
  before update on public.profiles
  for each row
  execute function public.profiles_username_before_update();

drop policy if exists "Users update own profile" on public.profiles;

create policy "Users update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
