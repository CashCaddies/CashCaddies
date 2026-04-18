alter table public.profiles
add column if not exists is_founder boolean default false;
