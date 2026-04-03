-- Flag pending users as waitlisted when beta program is at capacity (admin queue).

alter table public.profiles
  add column if not exists beta_waitlist boolean not null default false;

comment on column public.profiles.beta_waitlist is
  'When true, user is flagged as waitlisted while beta_status remains pending/rejected; used when program is at capacity.';

-- Extend audit log for waitlist toggles.
alter table public.beta_approvals drop constraint if exists beta_approvals_action_check;

alter table public.beta_approvals
  add constraint beta_approvals_action_check check (
    action = any (
      array['approved'::text, 'rejected'::text, 'waitlist_on'::text, 'waitlist_off'::text]
    )
  );

-- Clear waitlist flag when approving via founding-tester RPC.
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
    beta_waitlist = false
  where id = p_target;
end;
$$;
