-- Draft lineups may exist before a contest is chosen; use null instead of a sentinel string.

alter table public.lineups
  alter column contest_id drop not null;

comment on column public.lineups.contest_id is
  'Lobby contest id (matches public.contests.id when set). Null when saved without a contest.';
