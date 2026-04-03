-- Allow rejected beta status; audit trail; let admin or senior_admin change beta fields (not only senior_admin).

alter table public.profiles drop constraint if exists beta_status_check;

alter table public.profiles
  add constraint beta_status_check check (
    beta_status = any (array['pending'::text, 'approved'::text, 'rejected'::text])
  );

create or replace function public.enforce_beta_approval_senior_admin() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  actor_role text;
begin
  if (new.beta_status is distinct from old.beta_status)
     or (new.beta_user is distinct from old.beta_user) then
    if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
      return new;
    end if;

    if auth.uid() is null then
      raise exception 'Unauthorized beta approval update.';
    end if;

    select p.role into actor_role
    from public.profiles p
    where p.id = auth.uid()
    limit 1;

    if coalesce(lower(actor_role), '') not in ('admin', 'senior_admin') then
      raise exception 'Only admin or senior_admin can approve or reject beta users.';
    end if;
  end if;

  return new;
end;
$$;

create table if not exists public.beta_approvals (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  changed_by uuid not null references public.profiles (id),
  created_at timestamp with time zone not null default now(),
  constraint beta_approvals_action_check check (action = any (array['approved'::text, 'rejected'::text]))
);

comment on table public.beta_approvals is 'Audit log for beta approve/reject actions.';

create index if not exists beta_approvals_user_id_idx on public.beta_approvals (user_id);

create index if not exists beta_approvals_created_at_idx on public.beta_approvals (created_at desc);

alter table public.beta_approvals enable row level security;

create policy beta_approvals_select_staff
  on public.beta_approvals
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

grant select on table public.beta_approvals to authenticated;
grant all on table public.beta_approvals to service_role;
