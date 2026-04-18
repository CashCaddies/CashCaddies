create table if not exists public.update_responses (
  id uuid primary key default gen_random_uuid(),
  update_id uuid references public.updates (id) on delete set null,
  user_id uuid,
  message text,
  created_at timestamptz default now()
);

comment on table public.update_responses is 'User replies to product updates; surfaced to admin via API + email.';
