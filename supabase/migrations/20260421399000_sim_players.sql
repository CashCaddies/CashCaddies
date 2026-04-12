-- Sim / synthetic player pool (e.g. RBC Heritage Sim); separate from public.players and public.golfers.

create table if not exists public.sim_players (
  id uuid primary key default gen_random_uuid(),
  name text,
  salary int,
  rating int
);

comment on table public.sim_players is 'Synthetic DFS player rows for simulations (name, salary, rating).';

alter table public.sim_players enable row level security;

create policy "sim_players_select_all"
  on public.sim_players
  for select
  to anon, authenticated
  using (true);

grant select on table public.sim_players to anon;
grant select on table public.sim_players to authenticated;
grant all on table public.sim_players to service_role;
