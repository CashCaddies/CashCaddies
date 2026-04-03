-- Audit trail for admin actions (Command Center widget + future logging).

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  admin_display text,
  target text,
  details text,
  created_at timestamptz not null default now()
);

comment on table public.admin_logs is
  'Append-only admin audit log: action label, acting admin, optional target description.';

comment on column public.admin_logs.admin_display is
  'Optional display label for the admin (e.g. @handle or email) for UI without joining profiles.';

comment on column public.admin_logs.details is
  'Optional reason or extra context for the admin action.';

create index if not exists admin_logs_created_at_desc_idx on public.admin_logs (created_at desc);

alter table public.admin_logs enable row level security;

drop policy if exists "Admins read admin_logs" on public.admin_logs;
create policy "Admins read admin_logs"
  on public.admin_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

drop policy if exists "Admins insert own admin_logs" on public.admin_logs;
create policy "Admins insert own admin_logs"
  on public.admin_logs
  for insert
  to authenticated
  with check (
    admin_user_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

grant select, insert on public.admin_logs to authenticated;
