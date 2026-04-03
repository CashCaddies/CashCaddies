-- DFS golf fantasy: per-golfer per-contest stat lines and lineup totals from sum of golfer fantasy points.

-- Points: birdie +3, par +0.5, bogey -1, double bogey -3, eagle +8, albatross +13
create table if not exists public.golfer_scores (
  golfer_id uuid not null references public.golfers (id) on delete cascade,
  contest_id text not null,
  birdies integer not null default 0 check (birdies >= 0),
  pars integer not null default 0 check (pars >= 0),
  bogeys integer not null default 0 check (bogeys >= 0),
  double_bogeys integer not null default 0 check (double_bogeys >= 0),
  eagles integer not null default 0 check (eagles >= 0),
  albatrosses integer not null default 0 check (albatrosses >= 0),
  total_score numeric not null generated always as (
    round(
      (3::numeric * birdies)
      + (0.5::numeric * pars)
      + (-1::numeric * bogeys)
      + (-3::numeric * double_bogeys)
      + (8::numeric * eagles)
      + (13::numeric * albatrosses),
      2
    )
  ) stored,
  primary key (golfer_id, contest_id)
);

create index if not exists golfer_scores_contest_id_idx on public.golfer_scores (contest_id);

comment on table public.golfer_scores is
  'Per-golfer fantasy stats for a contest; total_score is derived from hole-outcome counts.';

alter table public.golfer_scores enable row level security;

drop policy if exists "Anyone can read golfer_scores" on public.golfer_scores;
create policy "Anyone can read golfer_scores"
  on public.golfer_scores
  for select
  to anon, authenticated
  using (true);

grant select on public.golfer_scores to anon, authenticated;

-- lineups.total_score = sum of per-golfer points for this contest (golfer_scores) or fallback to golfers.fantasy_points for drafts / missing rows.
drop function if exists public.refresh_lineup_total_scores_from_golfers() cascade;
create or replace function public.refresh_lineup_total_scores_from_golfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then coalesce(gs.total_score, g.fantasy_points, 0)::numeric
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.refresh_lineup_total_scores_from_golfers() is
  'Sets lineups.total_score: for contest lineups, sum golfer_scores.total_score (else golfers.fantasy_points); drafts sum fantasy_points only.';

-- Only lineups entered in this contest (same linkage as leaderboard).
drop function if exists public.refresh_lineup_total_scores_for_contest(text) cascade;
create or replace function public.refresh_lineup_total_scores_for_contest(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(coalesce(gs.total_score, g.fantasy_points, 0))::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0)
  where l.contest_id::text = p_contest_id
    and exists (
      select 1
      from public.contest_entries ce
      where ce.contest_id::text = p_contest_id
        and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

comment on function public.refresh_lineup_total_scores_for_contest(text) is
  'Recompute lineups.total_score for contest entries in p_contest_id from golfer_scores.';

grant execute on function public.refresh_lineup_total_scores_for_contest(text) to anon, authenticated;

-- Simulate: realistic stat distributions per (golfer, contest), then refresh lineup totals.
drop function if exists public.simulate_contest_lineup_scores(text) cascade;
create or replace function public.simulate_contest_lineup_scores(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.golfer_scores (
    golfer_id,
    contest_id,
    birdies,
    pars,
    bogeys,
    double_bogeys,
    eagles,
    albatrosses
  )
  select distinct
    lp.golfer_id,
    l.contest_id,
    (2 + floor(random() * 5))::integer,
    (8 + floor(random() * 7))::integer,
    floor(random() * 5)::integer,
    floor(random() * 3)::integer,
    floor(random() * 3)::integer,
    (case when random() < 0.07 then 1 else 0 end)::integer
  from public.lineup_players lp
  inner join public.lineups l on l.id = lp.lineup_id
  inner join public.contest_entries ce
    on ce.contest_id = l.contest_id
    and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
  where l.contest_id::text = p_contest_id
  on conflict (golfer_id, contest_id) do update set
    birdies = excluded.birdies,
    pars = excluded.pars,
    bogeys = excluded.bogeys,
    double_bogeys = excluded.double_bogeys,
    eagles = excluded.eagles,
    albatrosses = excluded.albatrosses;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  with updated as (
    select l.id
    from public.lineups l
    where l.contest_id::text = p_contest_id
      and exists (
        select 1
        from public.contest_entries ce
        where ce.contest_id::text = p_contest_id
          and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
      )
  )
  select count(*)::int into n from updated;

  return coalesce(n, 0);
end;
$$;

comment on function public.simulate_contest_lineup_scores(text) is
  'DFS simulate: upsert golfer_scores with realistic counts, refresh lineups.total_score for contest; returns row count of entered lineups.';

grant execute on function public.simulate_contest_lineup_scores(text) to anon, authenticated;

drop function if exists public.simulate_all_lineup_scores() cascade;
create or replace function public.simulate_all_lineup_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.golfer_scores (
    golfer_id,
    contest_id,
    birdies,
    pars,
    bogeys,
    double_bogeys,
    eagles,
    albatrosses
  )
  select distinct
    lp.golfer_id,
    l.contest_id,
    (2 + floor(random() * 5))::integer,
    (8 + floor(random() * 7))::integer,
    floor(random() * 5)::integer,
    floor(random() * 3)::integer,
    floor(random() * 3)::integer,
    (case when random() < 0.07 then 1 else 0 end)::integer
  from public.lineup_players lp
  inner join public.lineups l on l.id = lp.lineup_id
  where l.contest_id is not null
  on conflict (golfer_id, contest_id) do update set
    birdies = excluded.birdies,
    pars = excluded.pars,
    bogeys = excluded.bogeys,
    double_bogeys = excluded.double_bogeys,
    eagles = excluded.eagles,
    albatrosses = excluded.albatrosses;

  return public.refresh_lineup_total_scores_from_golfers();
end;
$$;

comment on function public.simulate_all_lineup_scores() is
  'DFS simulate: golfer_scores for all (golfer, contest) on lineups with contest_id; full refresh of lineups.total_score; returns lineup count.';

grant execute on function public.simulate_all_lineup_scores() to anon, authenticated;

grant execute on function public.refresh_lineup_total_scores_from_golfers() to service_role;

-- Demo RPC: keep random fantasy_points on golfers globally, then refresh (uses hybrid sum).
drop function if exists public.assign_random_golfer_scores() cascade;
create or replace function public.assign_random_golfer_scores()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.golfers
  set fantasy_points = round((35 + random() * 60)::numeric, 1);
  get diagnostics n = row_count;
  perform public.refresh_lineup_total_scores_from_golfers();
  return coalesce(n, 0);
end;
$$;
