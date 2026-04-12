-- Cut-line tracking on live sim rows (no table recreate).

alter table public.sim_live_state
  add column if not exists made_cut boolean default null,
  add column if not exists is_cut boolean default false;

comment on column public.sim_live_state.made_cut is
  'Null = unknown / pre-cut; true = made cut; false = missed cut.';

comment on column public.sim_live_state.is_cut is
  'True once player is eliminated from the cut (denormalized flag; optional vs made_cut).';
