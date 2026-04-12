-- After apply_cut(), players with made_cut = false stop advancing. Requires sim_live_state.made_cut (214100).

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
    select *
    from public.sim_live_state
    where (made_cut is null or made_cut = true)
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

    if rnd < 0.002 then
      update public.sim_live_state
      set
        hole = hole + 1,
        strokes = strokes - 2,
        fantasy_points = fantasy_points + 15,
        thru = (hole + 1)::text,
        updated_at = now()
      where player_id = sl.player_id
        and (made_cut is null or made_cut = true);

    elsif rnd < birdie_chance then
      if random() < 0.02 then
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 3,
          fantasy_points = fantasy_points + 11,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id
          and (made_cut is null or made_cut = true);

      elsif random() < 0.10 then
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 2,
          fantasy_points = fantasy_points + 8,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id
          and (made_cut is null or made_cut = true);

      else
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes - 1,
          fantasy_points = fantasy_points + 3,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id
          and (made_cut is null or made_cut = true);
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
        where player_id = sl.player_id
          and (made_cut is null or made_cut = true);
      else
        update public.sim_live_state
        set
          hole = hole + 1,
          strokes = strokes + 1,
          fantasy_points = fantasy_points - 0.5,
          thru = (hole + 1)::text,
          updated_at = now()
        where player_id = sl.player_id
          and (made_cut is null or made_cut = true);
      end if;

    else
      update public.sim_live_state
      set
        hole = hole + 1,
        fantasy_points = fantasy_points + 0.5,
        thru = (hole + 1)::text,
        updated_at = now()
      where player_id = sl.player_id
        and (made_cut is null or made_cut = true);
    end if;
  end loop;
end;
$$;

comment on function public.advance_one_hole() is
  'Advances sim_live_state one hole (RNG like run_rbc_sim); skips rows with made_cut = false after cut.';
