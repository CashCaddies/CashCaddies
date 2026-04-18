alter table public.profiles
  add column if not exists has_seen_portal_welcome boolean default false;
