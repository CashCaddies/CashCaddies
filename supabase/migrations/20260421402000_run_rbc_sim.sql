-- Monte Carlo sim: 72 independent hole draws per sim_players row, aggregated into round 1 totals.

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
end;
$$;

comment on function public.run_rbc_sim() is
  'Fills sim_results (round 1) from sim_players using random hole outcomes; re-run replaces round 1 rows.';

revoke all on function public.run_rbc_sim() from public;

grant execute on function public.run_rbc_sim() to authenticated, service_role;
