-- Per-golfer CashCaddie Protection coverage (tier limits how many slots per lineup).

alter table public.lineup_players
  add column if not exists is_protected boolean not null default false;

comment on column public.lineup_players.is_protected is 'CashCaddie Protection covers this golfer; tier caps how many may be true per lineup.';

-- Legacy lineups: whole-lineup protection treated as all golfers covered.
update public.lineup_players lp
set is_protected = true
from public.lineups l
where lp.lineup_id = l.id
  and l.protection_enabled = true;
