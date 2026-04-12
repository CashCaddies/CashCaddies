-- Live snapshot per sim player (current hole, running strokes/FP) for in-progress sim UX.

create table if not exists public.sim_live_state (
  player_id uuid not null references public.sim_players (id) on delete cascade,
  hole int not null default 0,
  strokes int not null default 0,
  fantasy_points double precision not null default 0,
  thru text not null default '0',
  updated_at timestamptz not null default now(),
  primary key (player_id),
  constraint sim_live_state_hole_nonnegative check (hole >= 0)
);

comment on table public.sim_live_state is
  'Live sim scoring snapshot: current hole, cumulative strokes and fantasy points, thru string; one row per player.';

alter table public.sim_live_state enable row level security;

create policy "sim_live_state_select_all"
  on public.sim_live_state
  for select
  to anon, authenticated
  using (true);

grant select on table public.sim_live_state to anon;
grant select on table public.sim_live_state to authenticated;
grant all on table public.sim_live_state to service_role;
