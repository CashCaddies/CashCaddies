-- Seed test contests (runs after 00000000000000_baseline.sql).
-- Do not recreate `contests` / `contest_entries` here — full DDL lives in the baseline + later migrations.
-- Status `open` matches baseline CHECK until 20260411200000 normalizes lifecycle values.

INSERT INTO public.contests (
  name,
  entry_fee,
  entry_fee_usd,
  max_entries,
  max_entries_per_user,
  start_date,
  starts_at,
  start_time,
  status,
  entries_open_at
)
VALUES
  (
    'RBC $500 High Roller',
    500,
    500,
    2,
    1,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day'),
    'open',
    now()
  ),
  (
    'RBC $5 Single Entry',
    5,
    5,
    1,
    1,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day'),
    'open',
    now()
  ),
  (
    'RBC $20 3-Max',
    20,
    20,
    3,
    1,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day')::timestamp,
    (now() + interval '1 day'),
    'open',
    now()
  );
