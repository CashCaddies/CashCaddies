-- OWGR (lower = better) → skill_rating; optional column + one-time backfill.
-- Requires skill_rating (see 214180); adds owgr if missing so the expression is valid.

alter table public.sim_players
  add column if not exists owgr integer;

comment on column public.sim_players.owgr is
  'Official World Golf Ranking–style rank when populated (lower is better); null → random skill band.';

alter table public.sim_players
  add column if not exists skill_rating int default 50;

update public.sim_players
set skill_rating =
  case
    when owgr is not null then
      greatest(30, least(95, 100 - owgr))
    else
      40 + floor(random() * 21)::int
  end;
