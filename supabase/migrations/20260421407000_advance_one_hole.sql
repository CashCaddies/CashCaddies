-- Advance each sim_live_state row by one hole using the same outcome distribution as run_rbc_sim (per-hole draw).

create or replace function public.advance_one_hole()
returns void
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  sl record;
  rnd float;
  birdie_chance float;
  bogey_chance float;
  v_rating int;
begin
  for sl in
    select * from public.sim_live_state
  loop
    if sl.hole >= 72 then
      continue;
    end if;

    select coalesce(sp.rating, 0)::int
    into v_rating
    from public.sim_players sp
    where sp.id = sl.player_id;

    birdie_chance := 0.15 + (v_rating * 0.013);
    bogey_chance := 0.18 - (v_rating * 0.01);

    rnd := random();

    -- Hole-out / hole-in-one style jackpot
    if rnd < 0.002 then
      update public.sim_live_state
      set
        hole = hole + 1,
        strokes = strokes - 2,
        fantasy_points = fantasy_points + 15,
        thru = (hole + 1)::text,
        updated_at = now()
      where player_id = sl.player_id;

    elsif rnd < birdie_chance then
      if random() < 0.02 then
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 3,
          fantasy_points = fantasy_points + 11,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id;

      elsif random() < 0.10 then
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 2,
          fantasy_points = fantasy_points + 8,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id;

      else
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 1,
          fantasy_points = fantasy_points + 3,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id;
      end if;

    elsif rnd < birdie_chance + bogey_chance then
      if random() < 0.10 then
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes + 2,
          fantasy_points = fantasy_points - 1,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id;
      else
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes + 1,
          fantasy_points = fantasy_points - 0.5,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id;
      end if;

    else
      update public.sim_live_state
      set
        hole = hole + 1,
        fantasy_points = fantasy_points + 0.5,
        thru = (hole + 1)::text,
        updated_at = now()
      where player_id = sl.player_id;
    end if;
  end loop;
end;
$$;

comment on function public.advance_one_hole() is
  'Advances each sim_live_state row by one hole (stops at 72); outcome RNG matches run_rbc_sim hole loop.';

revoke all on function public.advance_one_hole() from public;

grant execute on function public.advance_one_hole() to authenticated, service_role;
