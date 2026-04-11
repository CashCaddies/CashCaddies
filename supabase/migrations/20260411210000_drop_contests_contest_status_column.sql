-- Single lifecycle column: `public.contests.status` (see `20260411200000_contests_status_lifecycle.sql`).
ALTER TABLE public.contests DROP COLUMN IF EXISTS contest_status;
