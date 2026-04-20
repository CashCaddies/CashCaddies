-- Flag pending users as waitlisted when beta program is at capacity (admin queue).

alter table public.profiles
  add column if not exists beta_waitlist boolean not null default false;

comment on column public.profiles.beta_waitlist is
  'When true, user is flagged as waitlisted while beta_status remains pending/rejected; used when program is at capacity.';

-- Extend audit log for waitlist toggles (skip if beta_approvals not created yet).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'beta_approvals'
  ) THEN

    ALTER TABLE public.beta_approvals
    DROP CONSTRAINT IF EXISTS beta_approvals_action_check;

    ALTER TABLE public.beta_approvals
      ADD CONSTRAINT beta_approvals_action_check check (
        action = any (
          array['approved'::text, 'rejected'::text, 'waitlist_on'::text, 'waitlist_off'::text]
        )
      );

  END IF;
END $$;

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
