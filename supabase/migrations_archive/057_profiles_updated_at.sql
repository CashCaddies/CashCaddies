-- Some databases drifted without profiles.updated_at; wallet RPCs expect it. Safe to re-run.

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

comment on column public.profiles.updated_at is
  'Last update to profile row (wallet, tier, etc.).';
