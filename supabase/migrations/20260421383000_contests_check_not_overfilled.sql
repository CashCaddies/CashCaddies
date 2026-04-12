-- Enforce current_entries <= max_entries (repair any drift before adding the constraint).

update public.contests
set current_entries = max_entries
where current_entries > max_entries;

alter table public.contests
  drop constraint if exists check_not_overfilled;

alter table public.contests
  add constraint check_not_overfilled
  check (current_entries <= max_entries);
