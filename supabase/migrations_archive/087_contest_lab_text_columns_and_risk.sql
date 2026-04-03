-- Contest Lab: text columns for scenario/type, score columns on results (risk meter).

alter table public.simulation_results
  add column if not exists previous_score numeric,
  add column if not exists score_change numeric;

comment on column public.simulation_results.previous_score is
  'Leaderboard snapshot score for this entry before applying the hypothetical scenario.';

comment on column public.simulation_results.score_change is
  'simulated_score minus previous_score.';

-- Migrate enum columns to text (if migration 086 created enums).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'scenario'
      and udt_name = 'simulation_scenario'
  ) then
    alter table public.simulations alter column scenario type text using scenario::text;
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
      and udt_name = 'simulation_scope'
  ) then
    alter table public.simulations alter column simulation_type type text using simulation_type::text;
  end if;
end $$;

alter table public.simulations
  drop constraint if exists simulations_entry_scope_check;

alter table public.simulations
  add constraint simulations_entry_scope_check check (
    (simulation_type = 'ENTRY' and entry_id is not null)
    or simulation_type = 'CONTEST'
  );

alter table public.simulations
  drop constraint if exists simulations_simulation_type_check;

alter table public.simulations
  add constraint simulations_simulation_type_check check (simulation_type in ('ENTRY', 'CONTEST'));

drop type if exists public.simulation_scenario cascade;
drop type if exists public.simulation_scope cascade;
