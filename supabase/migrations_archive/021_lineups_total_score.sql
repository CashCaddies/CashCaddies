alter table public.lineups
  add column if not exists total_score numeric default 0;

comment on column public.lineups.total_score is
  'Aggregate fantasy score for this lineup (denormalized).';
