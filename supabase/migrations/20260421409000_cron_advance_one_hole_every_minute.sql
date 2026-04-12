-- Idempotent: register pg_cron job only if pg_cron is installed and the job name is free.
-- Requires: extension pg_cron + function public.advance_one_hole().

do $cron$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'cron_advance_one_hole: pg_cron not installed; skipping schedule';
    return;
  end if;

  if not exists (
    select 1
    from cron.job
    where jobname = 'advance_one_hole_every_minute'
  ) then
    perform cron.schedule(
      'advance_one_hole_every_minute',
      '* * * * *',
      $$ select public.advance_one_hole(); $$
    );
  end if;
end;
$cron$ language plpgsql;
