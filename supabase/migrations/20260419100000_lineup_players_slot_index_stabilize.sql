DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'lineup_players'
      AND c.column_name = 'slot_index'
  ) THEN
    RAISE EXCEPTION 'public.lineup_players.slot_index is missing; aborting migration';
  END IF;
END
$$;

ALTER TABLE public.lineup_players DISABLE TRIGGER ALL;

UPDATE public.lineup_players
SET slot_index = 0
WHERE slot_index IS NULL;

ALTER TABLE public.lineup_players ENABLE TRIGGER ALL;

ALTER TABLE public.lineup_players
ALTER COLUMN slot_index SET DEFAULT 0;

ALTER TABLE public.lineup_players
ALTER COLUMN slot_index SET NOT NULL;
