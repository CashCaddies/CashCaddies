DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'enforce_lineup_players_lock'
      AND n.nspname = 'public'
      AND c.relname = 'lineup_players'
  ) THEN
    ALTER TABLE public.lineup_players DISABLE TRIGGER enforce_lineup_players_lock;
  END IF;
END
$$;

UPDATE public.lineup_players
SET slot_index = 0
WHERE slot_index IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'enforce_lineup_players_lock'
      AND n.nspname = 'public'
      AND c.relname = 'lineup_players'
  ) THEN
    ALTER TABLE public.lineup_players ENABLE TRIGGER enforce_lineup_players_lock;
  END IF;
END
$$;

ALTER TABLE public.lineup_players
ALTER COLUMN slot_index SET DEFAULT 0;

ALTER TABLE public.lineup_players
ALTER COLUMN slot_index SET NOT NULL;
