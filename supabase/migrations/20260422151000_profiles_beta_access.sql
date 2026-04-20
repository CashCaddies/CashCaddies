-- Beta access flag on profiles (run in SQL editor or via supabase db push)
alter table public.profiles
  add column if not exists beta_access boolean default false;

comment on column public.profiles.beta_access is
  'When true, user has beta product access (separate from beta_status / beta_user flows if used).';
