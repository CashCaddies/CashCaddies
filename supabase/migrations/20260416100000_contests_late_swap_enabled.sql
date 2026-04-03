-- Per-contest late swap feature flag. New column only; no UPDATEs on other columns.
-- Existing rows receive late_swap_enabled = false via the column default (additive schema change).

alter table public.contests
  add column if not exists late_swap_enabled boolean not null default false;

comment on column public.contests.late_swap_enabled is 'When true, late-swap rules apply after contest lock per product logic.';
