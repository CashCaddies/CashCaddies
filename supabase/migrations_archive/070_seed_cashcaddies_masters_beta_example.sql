-- Example closed-beta contest: lobby (`contests_with_stats`), capacity, prize pool math, payouts.
--
-- Stable id for docs and deep links (lowercase UUID string in the app):
--   /lobby/c0ffee00-0000-4000-b00d-00000000be7a
--
-- Lobby compatibility:
--   - `fetchLobbyContests` reads contests_with_stats: id, name, entry_fee_usd, max_entries,
--     max_entries_per_user, current_entries, starts_at, ends_at, lineup_locked, prize_pool
--   - current_entries = contest_entry_count(contest_entries) — updates as users enter
--   - prize_pool = round(entry_fee_usd * current_entries, 2) — $0 fee => $0 pool until fee > 0
--
-- Manual checks after `supabase db push`:
--   select id, name, entry_fee_usd, max_entries, max_entries_per_user,
--          current_entries, prize_pool, lineup_locked, starts_at, ends_at
--   from public.contests_with_stats
--   where id = 'c0ffee00-0000-4000-b00d-00000000be7a'::uuid;

do $masters_beta$
declare
  v_id uuid := 'c0ffee00-0000-4000-b00d-00000000be7a';
  v_id_text text := 'c0ffee00-0000-4000-b00d-00000000be7a';
  v_starts timestamptz := (now() + interval '30 days');
  v_ends timestamptz := (now() + interval '30 days' + interval '4 days');
begin
  if exists (select 1 from public.contests c where c.id = v_id) then
    return;
  end if;

  insert into public.contests (
    id,
    name,
    entry_fee_usd,
    max_entries,
    max_entries_per_user,
    starts_at,
    ends_at
  )
  values (
    v_id,
    'CashCaddies Masters Beta',
    0,
    50,
    3,
    v_starts,
    v_ends
  );

  insert into public.contest_payouts (contest_id, rank_place, payout_pct)
  values
    (v_id_text, 1, 50),
    (v_id_text, 2, 30),
    (v_id_text, 3, 20)
  on conflict (contest_id, rank_place) do nothing;
end
$masters_beta$;

-- Post-seed validation (no-op if contest row missing, e.g. partial migrate).
do $validate_masters_beta$
declare
  v_id uuid := 'c0ffee00-0000-4000-b00d-00000000be7a';
  v_row record;
  v_payouts int;
begin
  if not exists (select 1 from public.contests c where c.id = v_id) then
    return;
  end if;

  select * into strict v_row
  from public.contests_with_stats
  where id = v_id;

  if v_row.name is distinct from 'CashCaddies Masters Beta' then
    raise exception 'seed validation: unexpected contest name %', v_row.name;
  end if;
  if v_row.entry_fee_usd is distinct from 0::numeric then
    raise exception 'seed validation: entry_fee_usd should be 0, got %', v_row.entry_fee_usd;
  end if;
  if v_row.max_entries is distinct from 50 then
    raise exception 'seed validation: max_entries should be 50';
  end if;
  if v_row.max_entries_per_user is distinct from 3 then
    raise exception 'seed validation: max_entries_per_user should be 3';
  end if;
  if v_row.current_entries is distinct from 0 then
    raise exception 'seed validation: current_entries should be 0 before any entries';
  end if;
  if v_row.prize_pool is distinct from 0::numeric then
    raise exception 'seed validation: prize_pool should be 0 when fee is 0 and entries are 0';
  end if;
  if v_row.lineup_locked is not false then
    raise exception 'seed validation: lineup_locked should be false while starts_at is in the future';
  end if;
  if v_row.ends_at is null or not (v_row.starts_at < v_row.ends_at) then
    raise exception 'seed validation: ends_at must be set and after starts_at';
  end if;

  select count(*)::int
  into v_payouts
  from public.contest_payouts pp
  where pp.contest_id = v_id::text;

  if v_payouts < 3 then
    raise exception 'seed validation: expected at least 3 contest_payouts rows for Masters Beta';
  end if;
end
$validate_masters_beta$;
