-- Contest Lab (Simulation Engine): hypothetical entry simulations; never mutates contest data.

create type public.simulation_scope as enum ('ENTRY', 'CONTEST');

create type public.simulation_scenario as enum (
  'WD',
  'RANDOM_WD',
  'BAD_ROUND',
  'HOT_ROUND',
  'MISS_CUT',
  'CHAOS'
);

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id text not null references public.contests (id) on delete cascade,
  entry_id uuid references public.contest_entries (id) on delete cascade,
  simulation_type public.simulation_scope not null default 'ENTRY',
  scenario public.simulation_scenario not null,
  affected_golfer_id uuid references public.golfers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint simulations_entry_scope_check check (
    (simulation_type = 'ENTRY' and entry_id is not null)
    or simulation_type = 'CONTEST'
  )
);

create index if not exists simulations_user_created_idx on public.simulations (user_id, created_at desc);
create index if not exists simulations_entry_idx on public.simulations (entry_id);

comment on table public.simulations is
  'Contest Lab: user-run hypothetical scenarios; ENTRY scope ties to contest_entries; CONTEST reserved for future full-field sims.';

create table public.simulation_results (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  entry_id uuid not null references public.contest_entries (id) on delete cascade,
  simulated_score numeric not null,
  simulated_position integer not null check (simulated_position >= 1),
  previous_position integer not null check (previous_position >= 1),
  position_change integer not null,
  created_at timestamptz not null default now()
);

create index if not exists simulation_results_simulation_idx on public.simulation_results (simulation_id);

comment on table public.simulation_results is
  'Contest Lab output: projected score/rank vs leaderboard snapshot at run time; position_change = previous_position - simulated_position (positive = moved up).';

comment on column public.simulation_results.position_change is
  'previous_position minus simulated_position; positive means improved standing (lower rank number).';

alter table public.simulations enable row level security;
alter table public.simulation_results enable row level security;

drop policy if exists "Users read own simulations" on public.simulations;
create policy "Users read own simulations"
  on public.simulations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own simulations" on public.simulations;
create policy "Users insert own simulations"
  on public.simulations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own simulation_results" on public.simulation_results;
create policy "Users read own simulation_results"
  on public.simulation_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulations s
      where s.id = simulation_results.simulation_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users insert own simulation_results" on public.simulation_results;
create policy "Users insert own simulation_results"
  on public.simulation_results
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulations s
      where s.id = simulation_results.simulation_id
        and s.user_id = (select auth.uid())
    )
  );

grant select, insert on public.simulations to authenticated;
grant select, insert on public.simulation_results to authenticated;
