-- Contests still in play (not complete / settled / cancelled). Lifecycle migration renamed legacy `open` → `filling`.

create or replace function public.admin_active_contests()
returns integer
language sql
security definer
set search_path to public
stable
as $$
  select count(*)::integer
  from public.contests c
  where c.status in ('filling', 'locked', 'live');
$$;

comment on function public.admin_active_contests() is
  'Count contests with status filling, locked, or live (see contests_status_lifecycle_check). Service role only.';

revoke all on function public.admin_active_contests() from public;

grant execute on function public.admin_active_contests() to service_role;
