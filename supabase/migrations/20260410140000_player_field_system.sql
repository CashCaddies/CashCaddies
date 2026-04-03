-- Phase 1: Player field — roster of golfers per tournament (salary, status, tee metadata).
-- References public.tournaments from tournament_system_foundation. Does not alter existing tables.

-- ---------------------------------------------------------------------------
-- players (DFS player identity; distinct from legacy golfers roster if both exist)
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tour text,
  country text,
  created_at timestamptz not null default now()
);

comment on table public.players is 'Golfer identity for tournament fields (name, tour, country).';

alter table public.players enable row level security;

create policy "players_select_all"
  on public.players
  for select
  to anon, authenticated
  using (true);

grant select on table public.players to anon;
grant select on table public.players to authenticated;
grant all on table public.players to service_role;

-- ---------------------------------------------------------------------------
-- tournament_players (field row: salary, status, tee for one player in one event)
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  salary integer,
  status text default 'active', -- active / cut / wd
  tee_time timestamptz,
  starting_hole integer,
  created_at timestamptz not null default now()
);

comment on table public.tournament_players is 'Tournament field entry: salary, active/cut/wd, tee time and starting hole.';
comment on column public.tournament_players.status is 'active | cut | wd';

create unique index if not exists tournament_players_tournament_player_uidx
  on public.tournament_players (tournament_id, player_id);

-- tournament_id lookups use the leading column of tournament_players_tournament_player_uidx
create index if not exists tournament_players_player_id_idx
  on public.tournament_players (player_id);

create index if not exists tournament_players_status_idx
  on public.tournament_players (status);

alter table public.tournament_players enable row level security;

create policy "tournament_players_select_all"
  on public.tournament_players
  for select
  to anon, authenticated
  using (true);

grant select on table public.tournament_players to anon;
grant select on table public.tournament_players to authenticated;
grant all on table public.tournament_players to service_role;
