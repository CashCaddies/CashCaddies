-- One row per contest entry (payment + metadata). Lineups reference this after save.

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null,
  entry_fee numeric not null default 0,
  protection_fee numeric not null default 0,
  total_paid numeric not null default 0,
  protection_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contest_entries_user_created_idx on public.contest_entries (user_id, created_at desc);
create index if not exists contest_entries_contest_idx on public.contest_entries (contest_id);

comment on table public.contest_entries is 'Contest entry ledger row created when user enters; fees match transactions + lineup.';
comment on column public.contest_entries.total_paid is 'entry_fee + protection_fee; deducted from site_credits then account_balance.';

alter table public.contest_entries enable row level security;

drop policy if exists "Users select own contest entries" on public.contest_entries;
create policy "Users select own contest entries"
  on public.contest_entries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own contest entries" on public.contest_entries;
create policy "Users insert own contest entries"
  on public.contest_entries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own contest entries" on public.contest_entries;
create policy "Users delete own contest entries"
  on public.contest_entries
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Service role bypasses RLS for payment pipeline; user may insert/delete own rows for free entries.

alter table public.lineups
  add column if not exists contest_entry_id uuid references public.contest_entries (id) on delete set null;

create index if not exists lineups_contest_entry_id_idx on public.lineups (contest_entry_id);

comment on column public.lineups.contest_entry_id is 'Links lineup to the contest_entries payment row.';
