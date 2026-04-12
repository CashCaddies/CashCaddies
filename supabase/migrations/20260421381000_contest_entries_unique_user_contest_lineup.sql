-- Prevent the same user from submitting the same lineup twice into one contest.
-- There is no `entries` table or `lineup` json column here: roster lives in `lineups` + `lineup_players`,
-- and `contest_entries.lineup_id` references that lineup. Uniqueness on (user, contest, lineup_id)
-- enforces "exact duplicate lineup" at the row level.

create unique index if not exists uniq_user_lineup_per_contest
  on public.contest_entries (user_id, contest_id, lineup_id)
  where lineup_id is not null
    and user_id is not null
    and contest_id is not null;
