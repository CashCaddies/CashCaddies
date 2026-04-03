Archived Supabase migrations (moved intact; SQL not modified).

Active migrations folder (../migrations/) keeps a single file:
  20260412_contest_entries_align.sql

If your `supabase db pull` produced a different filename, replace that sole file with the
pull output (rename to a single timestamp_name.sql) so the repo matches remote schema.

Remote migration history: after squashing locally, align the linked database with
`supabase migration list` / `supabase migration repair` per Supabase docs so versions match.
