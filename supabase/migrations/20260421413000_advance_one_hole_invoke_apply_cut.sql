-- After each advance_one_hole() batch, run apply_cut() once at end of R2.
-- sim_live_state has no `round`; `hole` is cumulative holes played (0..72). End of R2 = everyone at hole >= 36.
-- Run only once: all made_cut still null (apply_cut sets true/false for everyone).

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

  if exists (select 1 from public.sim_live_state limit 1)
     and coalesce((select min(hole) from public.sim_live_state), 0) >= 36
     and (select bool_and(made_cut is null) from public.sim_live_state) then
    perform public.apply_cut();
  end if;
end;
$$;

comment on function public.advance_one_hole() is
  'Advances sim_live_state one hole; after R2 (min hole >= 36) runs apply_cut once; skips made_cut = false.';
