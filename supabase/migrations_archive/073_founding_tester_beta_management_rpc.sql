-- Founding testers: list profiles and update beta / founding_tester flags on others (additive; no deletes; no auth changes).
-- Callers must have profiles.founding_tester = true. Self-target updates are rejected.

create or replace function public.founding_tester_list_beta_profiles()
returns table (
  id uuid,
  username text,
  email text,
  beta_user boolean,
  beta_status text,
  founding_tester boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.username,
    p.email,
    p.beta_user,
    p.beta_status,
    p.founding_tester,
    p.updated_at
  from public.profiles p
  where p.id <> (select auth.uid())
  order by p.updated_at desc nulls last
  limit 100;
end;
$$;

comment on function public.founding_tester_list_beta_profiles() is
  'Returns up to 100 other profiles for beta management; caller must be founding_tester.';

create or replace function public.founding_tester_approve_beta(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  if p_target = (select auth.uid()) then
    raise exception 'cannot approve own profile via this action'
      using errcode = '42501';
  end if;

  update public.profiles
  set
    beta_user = true,
    beta_status = 'approved',
    updated_at = now()
  where id = p_target;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.founding_tester_approve_beta(uuid) is
  'Sets beta_user true and beta_status approved for another profile; caller must be founding_tester.';

create or replace function public.founding_tester_toggle_founding_tester(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean;
  n integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  if p_target = (select auth.uid()) then
    raise exception 'cannot change own founding_tester via this action'
      using errcode = '42501';
  end if;

  update public.profiles
  set
    founding_tester = not coalesce(founding_tester, false),
    updated_at = now()
  where id = p_target
  returning founding_tester into v_new;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'profile not found'
      using errcode = 'P0002';
  end if;

  return v_new;
end;
$$;

comment on function public.founding_tester_toggle_founding_tester(uuid) is
  'Toggles founding_tester on another profile; caller must be founding_tester.';

grant execute on function public.founding_tester_list_beta_profiles() to authenticated;
grant execute on function public.founding_tester_approve_beta(uuid) to authenticated;
grant execute on function public.founding_tester_toggle_founding_tester(uuid) to authenticated;
