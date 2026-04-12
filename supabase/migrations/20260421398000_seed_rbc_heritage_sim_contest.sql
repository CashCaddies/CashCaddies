-- One-off sim contest: RBC Heritage Sim ($5 entry, 50k salary cap, 150 seats).
-- contests.status uses lifecycle values (not "upcoming"); salary_cap lives on contests for sim rows without a template.

alter table public.contests
  add column if not exists salary_cap integer;

comment on column public.contests.salary_cap is
  'Optional DFS salary budget (cents or arbitrary units consistent with players.salary); used when no contest_templates row.';

do $seed$
declare
  v_start timestamptz := now() + interval '1 day';
begin
  if exists (select 1 from public.contests c where c.name = 'RBC Heritage Sim') then
    raise notice 'seed 20260421398000: RBC Heritage Sim contest already exists; skipping insert';
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
    current_entries
  )
  values (
    'RBC Heritage Sim',
    5,
    5,
    500,
    150,
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
    0
  );
end;
$seed$;
