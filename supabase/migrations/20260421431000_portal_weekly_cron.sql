-- Weekly portal contest creator + pg_cron schedule.
-- Creates one "weekly" portal contest per ISO week and injects overlay_amount.

create or replace function public.create_weekly_portal_contest()
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_week_start date := date_trunc('week', now() at time zone 'utc')::date;
  v_starts_at timestamptz := (v_week_start::timestamp + interval '4 days' + interval '20 hours') at time zone 'utc';
  v_name text := format('Weekly Portal %s', to_char(v_week_start, 'YYYY-MM-DD'));
  v_overlay numeric := 2500;
  v_entry_fee_usd integer := 25;
  v_max_entries integer := 200;
  v_prize_pool_usd numeric := (v_entry_fee_usd * v_max_entries) + v_overlay;
  v_contest public.contests;
begin
  if exists (
    select 1
    from public.contests c
    where c.is_portal = true
      and c.portal_frequency = 'weekly'
      and c.name = v_name
  ) then
    return jsonb_build_object('ok', true, 'created', false, 'reason', 'already_exists');
  end if;

  insert into public.contests (
    name,
    entry_fee,
    entry_fee_usd,
    entry_fee_cents,
    max_entries,
    max_entries_per_user,
    prize_pool,
    overlay_amount,
    is_portal,
    portal_frequency,
    is_featured,
    starts_at,
    start_time,
    entries_open_at,
    status,
    entry_count,
    current_entries
  )
  values (
    v_name,
    v_entry_fee_usd,
    v_entry_fee_usd,
    v_entry_fee_usd * 100,
    v_max_entries,
    1,
    v_prize_pool_usd,
    v_overlay,
    true,
    'weekly',
    true,
    v_starts_at::timestamp,
    v_starts_at,
    now(),
    'filling',
    0,
    0
  )
  returning * into v_contest;

  return jsonb_build_object('ok', true, 'created', true, 'contest_id', v_contest.id);
end;
$$;

comment on function public.create_weekly_portal_contest() is
  'Creates one weekly portal contest with injected overlay_amount; idempotent per ISO week.';

revoke all on function public.create_weekly_portal_contest() from public;
grant execute on function public.create_weekly_portal_contest() to service_role;

do $cron$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'portal_weekly_cron: pg_cron not installed; skipping schedule';
    return;
  end if;

  if not exists (
    select 1
    from cron.job
    where jobname = 'create_weekly_portal_contest'
  ) then
    perform cron.schedule(
      'create_weekly_portal_contest',
      '0 12 * * 1',
      $$ select public.create_weekly_portal_contest(); $$
    );
  end if;
end;
$cron$ language plpgsql;
