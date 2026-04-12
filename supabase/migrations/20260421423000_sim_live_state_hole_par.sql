-- Extend live sim snapshot; does not recreate sim_live_state.

alter table public.sim_live_state
  add column if not exists hole_par int default 4;

comment on column public.sim_live_state.hole_par is
  'Par for the current hole context (default 4); adjust per hole when modeling par-3/5.';
