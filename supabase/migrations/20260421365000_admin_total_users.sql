-- Total app users (profile rows; ids match auth.users). Callable with service role only.

create or replace function public.admin_total_users()
returns integer
language sql
security definer
set search_path to public
stable
as $$
  select count(*)::integer from public.profiles;
$$;

comment on function public.admin_total_users() is 'Returns count(public.profiles). Use from trusted server (service role), not anon.';

revoke all on function public.admin_total_users() from public;

grant execute on function public.admin_total_users() to service_role;
