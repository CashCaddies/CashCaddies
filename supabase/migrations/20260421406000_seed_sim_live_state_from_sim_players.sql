-- One row per sim player with column defaults (hole 0, strokes 0, etc.).

insert into public.sim_live_state (player_id)
select sp.id
from public.sim_players sp
on conflict (player_id) do nothing;
