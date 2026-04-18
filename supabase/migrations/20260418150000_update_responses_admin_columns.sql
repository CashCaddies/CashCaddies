alter table public.update_responses
add column if not exists is_read boolean default false;

alter table public.update_responses
add column if not exists admin_reply text;
