-- Reliable row count: GET DIAGNOSTICS ROW_COUNT after UPDATE can report 0 in some cases;
-- use UPDATE ... RETURNING and count those rows instead.

drop function if exists public.simulate_contest_lineup_scores(text) cascade;
create or replace function public.simulate_contest_lineup_scores(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with updated as (
    update public.lineups l
    set total_score = round((150 + random() * 200)::numeric, 1)
    where exists (
      select 1
      from public.contest_entries ce
      where ce.contest_id::text = p_contest_id
        and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
    )
    returning l.id
  )
  select count(*)::int into n from updated;

  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_contest_lineup_scores(text) is
  'Random lineups.total_score for lineups tied to contest_entries; return count of updated rows.';

grant execute on function public.simulate_contest_lineup_scores(text) to anon, authenticated;

-- Same pattern for admin "simulate all" count reliability.
drop function if exists public.simulate_all_lineup_scores() cascade;
create or replace function public.simulate_all_lineup_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with updated as (
    update public.lineups
    set total_score = round((150 + random() * 200)::numeric, 1)
    returning id
  )
  select count(*)::int into n from updated;

  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_all_lineup_scores() is 'Sets random lineups.total_score on all lineups; returns count updated.';

grant execute on function public.simulate_all_lineup_scores() to anon, authenticated;
