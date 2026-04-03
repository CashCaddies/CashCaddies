-- Phase 1: Link contests to tournaments (DFS).
-- Baseline already has contests.max_entries, contests.status (open/locked/live/…),
-- and contests.entry_count (kept; triggers still maintain it). This migration adds
-- tournament linkage, entry_deadline, tournament phase (upcoming/live/completed),
-- and a stored current_entries mirror without dropping or renaming columns.
--
-- Column name note: a second column named "status" is impossible while contests.status
-- exists; tournament_status holds upcoming | live | completed per spec.

-- ---------------------------------------------------------------------------
-- Columns (nullable / safe defaults for existing rows)
-- ---------------------------------------------------------------------------
alter table public.contests
  add column if not exists tournament_id uuid references public.tournaments (id) on delete cascade;

alter table public.contests
  add column if not exists max_entries integer default 100;

alter table public.contests
  add column if not exists tournament_status text default 'upcoming';

comment on column public.contests.tournament_status is 'Tournament slate phase: upcoming | live | completed (separate from contests.status).';

alter table public.contests
  add column if not exists entry_deadline timestamp without time zone;

alter table public.contests
  add column if not exists current_entries integer not null default 0;

-- One-time alignment with existing synced entry_count (migration assumed run once).
update public.contests c
set current_entries = coalesce(c.entry_count, 0);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
alter table public.contests drop constraint if exists contests_current_entries_nonnegative;

alter table public.contests
  add constraint contests_current_entries_nonnegative
  check (current_entries >= 0);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists contests_tournament_id_idx on public.contests (tournament_id);

create index if not exists contests_tournament_status_idx on public.contests (tournament_status);
