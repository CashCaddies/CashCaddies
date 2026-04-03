-- contest_entries: additive alignment with frontend selects (fixes PostgREST 400 when columns/embeds drift).
-- public.contests.id is text (013_contests.sql); contest_id is text — UUID strings are stored as text.

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  lineup_id uuid,
  entry_fee numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.contest_entries add column if not exists entry_number integer;
alter table public.contest_entries add column if not exists protection_fee numeric not null default 0;
alter table public.contest_entries add column if not exists total_paid numeric not null default 0;
alter table public.contest_entries add column if not exists protection_enabled boolean not null default false;
alter table public.contest_entries add column if not exists protection_triggered boolean not null default false;
alter table public.contest_entries add column if not exists protected_golfer_id uuid;
alter table public.contest_entries add column if not exists protection_token_issued boolean not null default false;

create index if not exists contest_entries_user_created_idx
  on public.contest_entries (user_id, created_at desc);
create index if not exists contest_entries_contest_idx
  on public.contest_entries (contest_id);
