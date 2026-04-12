-- Per-round sim scoring for synthetic players (public.sim_players).

create table if not exists public.sim_results (
  player_id uuid not null references public.sim_players (id) on delete cascade,
  round int not null,
  strokes int,
  fantasy_points int,
  primary key (player_id, round),
  constraint sim_results_round_positive check (round >= 1)
);

comment on table public.sim_results is 'Sim contest results: strokes and fantasy points per player per round.';

create index if not exists sim_results_round_idx on public.sim_results (round);

alter table public.sim_results enable row level security;

create policy "sim_results_select_all"
  on public.sim_results
  for select
  to anon, authenticated
  using (true);

grant select on table public.sim_results to anon;
grant select on table public.sim_results to authenticated;
grant all on table public.sim_results to service_role;
