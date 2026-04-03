alter table public.contests
add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists contests_created_by_idx on public.contests (created_by);
