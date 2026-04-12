-- Extend synthetic player pool; does not recreate sim_players.

alter table public.sim_players
  add column if not exists skill_rating int default 50;

comment on column public.sim_players.skill_rating is
  'Optional skill scalar for sim tuning (default 50); distinct from rating when both exist.';
