-- Audit log for administrative actions (staff read-only from clients; service_role for writes).

create table if not exists public.admin_actions (
  id uuid not null default gen_random_uuid() primary key,
  admin_user_id uuid references public.profiles (id) on delete set null,
  action_type text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_actions is 'Audit log of administrative actions.';

create index if not exists admin_actions_admin_user_id_idx on public.admin_actions (admin_user_id);

create index if not exists admin_actions_target_user_id_idx on public.admin_actions (target_user_id);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

-- Authenticated staff may read; no policy for insert/update/delete on authenticated (service_role bypasses RLS).
create policy admin_actions_select_staff
  on public.admin_actions
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

-- No grants to anon (no public access).
grant select on table public.admin_actions to authenticated;

grant all on table public.admin_actions to service_role;
