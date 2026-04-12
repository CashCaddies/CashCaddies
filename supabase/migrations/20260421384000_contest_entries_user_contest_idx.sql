-- Speed lookups by user + contest (there is no `public.entries` table; ledger is `contest_entries`).

create index if not exists idx_entries_user_contest
  on public.contest_entries (user_id, contest_id);
