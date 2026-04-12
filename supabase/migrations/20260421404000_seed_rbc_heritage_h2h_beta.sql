-- H2H beta contest: 2 seats, $10 entry, 50k cap; sim pool + sim_results scoring (uses_sim_pool).
-- Replaces invalid manual insert (status cannot be 'upcoming'; needs starts_at / fee columns).

do $seed$
declare
  v_start timestamptz := timestamptz '2026-04-16 12:00:00';
begin
  if exists (select 1 from public.contests c where c.name = 'RBC Heritage H2H Beta') then
    raise notice 'seed 20260421404000: RBC Heritage H2H Beta already exists; skipping insert';
    return;
  end if;

  insert into public.contests (
    name,
    entry_fee,
    entry_fee_usd,
    entry_fee_cents,
    max_entries,
    max_entries_per_user,
    salary_cap,
    prize_pool,
    rake_percent,
    payout_structure,
    sport,
    starts_at,
    start_time,
    entries_open_at,
    status,
    entry_count,
    current_entries,
    uses_sim_pool
  )
  values (
    'RBC Heritage H2H Beta',
    10,
    10,
    1000,
    2,
    1,
    50000,
    0,
    10,
    '[]'::jsonb,
    'golf',
    v_start::timestamp,
    v_start,
    now(),
    'filling',
    0,
    0,
    true
  );
end;
$seed$;
