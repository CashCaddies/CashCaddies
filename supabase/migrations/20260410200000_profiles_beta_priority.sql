-- Beta waitlist / access tier (senior_admin can set via app server action + service role).

alter table public.profiles
  add column if not exists beta_priority text not null default 'normal';

alter table public.profiles drop constraint if exists profiles_beta_priority_check;

alter table public.profiles
  add constraint profiles_beta_priority_check
  check (beta_priority = any (array['normal'::text, 'founder'::text, 'vip'::text]));

comment on column public.profiles.beta_priority is
  'Beta tier for prioritization: normal | founder | vip. Updated by senior_admin tooling.';
