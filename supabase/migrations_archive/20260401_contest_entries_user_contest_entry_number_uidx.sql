-- Idempotent: index originally created in 043_contest_entry_atomic_transaction.sql.
-- Ensures (user_id, contest_id, entry_number) uniqueness for concurrent entry creation.
create unique index if not exists contest_entries_user_contest_entry_number_uidx
  on public.contest_entries (user_id, contest_id, entry_number);
