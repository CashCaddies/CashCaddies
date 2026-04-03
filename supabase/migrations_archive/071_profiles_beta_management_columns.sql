-- Private beta admin fields on public.profiles (additive only; no changes to auth.users or existing columns).
-- Existing rows: beta_user and founding_tester become false; beta_status becomes 'pending'; beta_notes stays null.
-- Use beta_user = true to flag active beta testers; treat status as meaningful mainly when beta_user is true.

alter table public.profiles
  add column if not exists beta_user boolean not null default false;

alter table public.profiles
  add column if not exists beta_status text not null default 'pending';

alter table public.profiles
  add column if not exists founding_tester boolean not null default false;

alter table public.profiles
  add column if not exists beta_notes text;

comment on column public.profiles.beta_user is
  'True when this profile is part of the private beta cohort (admin-managed).';

comment on column public.profiles.beta_status is
  'Workflow label for beta onboarding (e.g. pending, approved, invited, active); values are app/admin conventions.';

comment on column public.profiles.founding_tester is
  'Marks early trusted testers for recognition or priority comms; admin-set.';

comment on column public.profiles.beta_notes is
  'Internal founder/admin notes; keep out of client-facing selects if exposing profiles to users.';
