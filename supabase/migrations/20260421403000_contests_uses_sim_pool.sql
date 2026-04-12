-- Sim contests: flag on contests, mirror sim_players → golfers (same id for lineup_players FK),
-- leaderboard/payout totals from sim_results.fantasy_points via lineups.total_score refresh.

alter table public.contests
  add column if not exists uses_sim_pool boolean not null default false;

comment on column public.contests.uses_sim_pool is
  'When true, roster picks use public.sim_players (mirrored into golfers); scoring uses sim_results.fantasy_points.';

-- Keep golfers rows in sync with sim_players (lineup_players.golfer_id → golfers.id).
create or replace function public.trg_sync_sim_player_to_golfer()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  insert into public.golfers (id, name, salary, fantasy_points, withdrawn, position)
  values (new.id, new.name, new.salary, 0, false, coalesce(new.rating, 0))
  on conflict (id) do update set
    name = excluded.name,
    salary = excluded.salary,
    position = excluded.position;
  return new;
end;
$$;

drop trigger if exists sync_sim_players_to_golfers_trg on public.sim_players;
create trigger sync_sim_players_to_golfers_trg
  after insert or update on public.sim_players
  for each row execute function public.trg_sync_sim_player_to_golfer();

-- One-time backfill + replay trigger for existing rows.
insert into public.golfers (id, name, salary, fantasy_points, withdrawn, position)
select sp.id, sp.name, sp.salary, 0, false, coalesce(sp.rating, 0)
from public.sim_players sp
on conflict (id) do update set
  name = excluded.name,
  salary = excluded.salary,
  position = excluded.position;

-- Recompute one lineup's total_score from sim_results (all rounds) for sim contests.
create or replace function public.refresh_one_lineup_sim_total(p_lineup_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_contest uuid;
  v_uses boolean;
begin
  select l.contest_id into v_contest from public.lineups l where l.id = p_lineup_id;
  if v_contest is null then
    return;
  end if;
  select c.uses_sim_pool into v_uses from public.contests c where c.id = v_contest;
  if not coalesce(v_uses, false) then
    return;
  end if;

  update public.lineups l
  set total_score = (
    select coalesce(sum(z.player_fp), 0)::int
    from (
      select (
        select coalesce(sum(sr.fantasy_points), 0)
        from public.sim_results sr
        where sr.player_id = lp.golfer_id
      ) as player_fp
      from public.lineup_players lp
      where lp.lineup_id = p_lineup_id
    ) z
  )
  where l.id = p_lineup_id;
end;
$$;

comment on function public.refresh_one_lineup_sim_total(uuid) is
  'Sets lineups.total_score from sum of per-player sim_results.fantasy_points when the lineup contest uses_sim_pool.';

-- Refresh all sim-contest lineups (e.g. after run_rbc_sim).
create or replace function public.refresh_sim_lineup_totals()
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  r record;
begin
  for r in
    select distinct lp.lineup_id as lid
    from public.lineup_players lp
    inner join public.lineups ln on ln.id = lp.lineup_id
    inner join public.contests c on c.id = ln.contest_id and c.uses_sim_pool is true
  loop
    perform public.refresh_one_lineup_sim_total(r.lid);
  end loop;
end;
$$;

comment on function public.refresh_sim_lineup_totals() is
  'Recomputes total_score for every lineup tied to a uses_sim_pool contest.';

create or replace function public.lineup_players_touch_sim_total()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_lineup uuid := coalesce(new.lineup_id, old.lineup_id);
begin
  perform public.refresh_one_lineup_sim_total(v_lineup);
  return coalesce(new, old);
end;
$$;

drop trigger if exists lineup_players_sim_total_trg on public.lineup_players;
create trigger lineup_players_sim_total_trg
  after insert or update or delete on public.lineup_players
  for each row execute function public.lineup_players_touch_sim_total();

-- RBC Heritage Sim contest uses the synthetic pool + sim_results scoring.
update public.contests
set uses_sim_pool = true
where name = 'RBC Heritage Sim';

-- Append refresh to Monte Carlo sim (replaces round 1 sim_results).
create or replace function public.run_rbc_sim()
returns void
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  p record;
  hole int;
  r_draw float;
  birdie_chance float;
  bogey_chance float;
  score int;
  points numeric;
begin
  for p in
    select * from public.sim_players
  loop
    birdie_chance := 0.15 + (coalesce(p.rating, 0) * 0.013);
    bogey_chance := 0.18 - (coalesce(p.rating, 0) * 0.01);

    score := 0;
    points := 0;

    for hole in 1..72
    loop
      r_draw := random();

      if r_draw < 0.002 then
        score := score - 2;
        points := points + 15;
      elsif r_draw < birdie_chance then
        if random() < 0.02 then
          points := points + 11;
          score := score - 3;
        elsif random() < 0.10 then
          points := points + 8;
          score := score - 2;
        else
          points := points + 3;
          score := score - 1;
        end if;
      elsif r_draw < birdie_chance + bogey_chance then
        if random() < 0.10 then
          points := points - 1;
          score := score + 2;
        else
          points := points - 0.5;
          score := score + 1;
        end if;
      else
        points := points + 0.5;
      end if;
    end loop;

    insert into public.sim_results (player_id, round, strokes, fantasy_points)
    values (p.id, 1, score, round(points)::int)
    on conflict (player_id, round) do update
      set strokes = excluded.strokes,
          fantasy_points = excluded.fantasy_points;
  end loop;

  perform public.refresh_sim_lineup_totals();
end;
$$;

comment on function public.run_rbc_sim() is
  'Fills sim_results (round 1) from sim_players using random hole outcomes; re-run replaces round 1 rows; refreshes sim lineup totals.';

revoke all on function public.refresh_one_lineup_sim_total(uuid) from public;
revoke all on function public.refresh_one_lineup_sim_total(uuid) from authenticated;
grant execute on function public.refresh_one_lineup_sim_total(uuid) to service_role;

revoke all on function public.refresh_sim_lineup_totals() from public;
revoke all on function public.refresh_sim_lineup_totals() from authenticated;
grant execute on function public.refresh_sim_lineup_totals() to service_role;
