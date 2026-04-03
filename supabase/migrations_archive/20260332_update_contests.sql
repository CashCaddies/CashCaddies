alter table public.contests add column if not exists status text default 'open';

alter table public.contests add column if not exists max_entries integer default 100;

alter table public.contests add column if not exists entry_count integer default 0;

alter table public.contests add column if not exists start_time timestamp;

alter table public.contests add column if not exists entry_fee numeric default 0;

