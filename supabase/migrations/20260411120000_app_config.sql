-- Key/value app configuration (e.g. beta capacity). Readable by staff admins; writable by senior_admin only.

create table if not exists public.app_config (
  key text not null primary key,
  value text not null,
  updated_at timestamp with time zone not null default now()
);

comment on table public.app_config is 'Application configuration key/value store.';

create or replace function public.touch_app_config_updated_at() returns trigger
  language plpgsql
  security invoker
  set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_config_touch_updated_at on public.app_config;

create trigger app_config_touch_updated_at
  before update on public.app_config
  for each row
  execute function public.touch_app_config_updated_at();

insert into public.app_config (key, value)
values ('max_beta_users', '20')
on conflict (key) do nothing;

alter table public.app_config enable row level security;

create policy app_config_select_staff
  on public.app_config
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

create policy app_config_insert_senior
  on public.app_config
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'senior_admin'
    )
  );

create policy app_config_update_senior
  on public.app_config
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'senior_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'senior_admin'
    )
  );

create policy app_config_delete_senior
  on public.app_config
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) = 'senior_admin'
    )
  );

grant select on table public.app_config to authenticated;
grant insert, update, delete on table public.app_config to authenticated;
grant all on table public.app_config to service_role;
