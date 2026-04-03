-- Fix profiles SELECT: avoid self-referential RLS (EXISTS subquery on profiles → recursion / 500).
-- Ensures users read own row and staff read all rows. Frontend should use .eq('id', user.id) for self fetches.

-- ---------------------------------------------------------------------------
-- Read current session user's role without evaluating profiles RLS (breaks recursion).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

alter function public.current_user_profile_role() owner to postgres;

revoke all on function public.current_user_profile_role() from public;
grant execute on function public.current_user_profile_role() to authenticated;
grant execute on function public.current_user_profile_role() to service_role;

comment on function public.current_user_profile_role() is
  'Returns profiles.role for auth.uid(); SECURITY DEFINER so RLS policies on profiles can check staff without recursion.';

-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Own profile (replaces legacy name; same predicate as historical "Users select own profile")
drop policy if exists "Users select own profile" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Staff: read any profile (uses helper — no subquery on profiles inside policy)
drop policy if exists "Admins can select all profiles" on public.profiles;
drop policy if exists "Admins can read profiles" on public.profiles;

create policy "Admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using (
    lower(coalesce(public.current_user_profile_role(), '')) in ('admin', 'senior_admin')
  );
