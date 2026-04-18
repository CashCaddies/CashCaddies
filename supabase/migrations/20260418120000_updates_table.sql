create table if not exists public.updates (
  id uuid primary key default gen_random_uuid(),
  title text,
  content text,
  tag text,
  time text,
  created_at timestamptz default now()
);

comment on table public.updates is 'CashCaddies product updates feed (homepage for logged-in users).';
