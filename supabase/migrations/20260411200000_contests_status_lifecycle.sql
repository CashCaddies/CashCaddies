-- Lifecycle for `public.contests.status` (single source of truth; not derived from dates).
-- Values: filling | locked | live | complete | settled | cancelled

ALTER TABLE public.contests DROP CONSTRAINT IF EXISTS contest_status_check;

UPDATE public.contests
SET status = CASE
  WHEN status IN ('open', 'full') OR status IS NULL OR trim(COALESCE(status, '')) = '' THEN 'filling'
  WHEN status = 'paid' THEN 'settled'
  WHEN status = 'completed' THEN 'complete'
  ELSE status
END;

UPDATE public.contests
SET status = 'filling'
WHERE status IS NOT NULL
  AND lower(trim(status)) NOT IN ('filling', 'locked', 'live', 'complete', 'settled', 'cancelled');

ALTER TABLE public.contests
  ALTER COLUMN status SET DEFAULT 'filling';

ALTER TABLE public.contests
  ADD CONSTRAINT contests_status_lifecycle_check
  CHECK (status = ANY (ARRAY['filling', 'locked', 'live', 'complete', 'settled', 'cancelled']::text[]));

COMMENT ON COLUMN public.contests.status IS 'Contest lifecycle: filling, locked, live, complete, settled, cancelled.';
