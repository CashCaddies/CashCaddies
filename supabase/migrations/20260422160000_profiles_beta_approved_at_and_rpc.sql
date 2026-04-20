-- When a user was approved for beta (audit / display).
alter table public.profiles
  add column if not exists beta_approved_at timestamptz;

comment on column public.profiles.beta_approved_at is
  'Timestamp when admin approved beta product access.';

-- Founding-tester approve path must match app-layer approval (beta_access + beta_approved_at).
create or replace function public.founding_tester_approve_beta(p_target uuid) returns void
  language plpgsql
  security definer
  set search_path to public
as $$
begin
  update public.profiles
  set
    beta_user = true,
    beta_status = 'approved',
    founding_tester = true,
    beta_waitlist = false,
    beta_access = true,
    beta_approved_at = now(),
    updated_at = now()
  where id = p_target;
end;
$$;
