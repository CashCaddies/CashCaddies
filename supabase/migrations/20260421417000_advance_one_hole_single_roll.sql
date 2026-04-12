-- Single random draw r vs v_birdie / v_par / v_bogey (no separate HIO gate).

create or replace function public.advance_one_hole()
returns void
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  sl record;
  r double precision;
  current_round int;
  v_is_weekend boolean;
  v_rank integer;
  v_birdie numeric;
  v_par numeric;
  v_bogey numeric;
  v_rand numeric;
  s numeric;
begin
  for sl in
    select *
    from public.sim_live_state
    where (made_cut is null or made_cut = true)
  loop
    if sl.hole >= 72 then
      continue;
    end if;

    current_round := case
      when sl.hole < 1 then 1
      else (sl.hole - 1) / 18 + 1
    end;

    v_is_weekend := current_round >= 3;

    v_rank := coalesce(public.get_player_rank(sl.player_id), 999);

    v_birdie := 0.20;
    v_par := 0.65;
    v_bogey := 0.15;

    if v_is_weekend then
      if v_rank <= 10 then
        v_birdie := v_birdie - 0.03;
        v_bogey := v_bogey + 0.03;
      end if;

      if v_rank > 20 then
        v_birdie := v_birdie + 0.03;
        v_bogey := v_bogey - 0.01;
      end if;
    end if;

    v_rand := 0.9 + random() * 0.2;
    v_birdie := v_birdie * v_rand;
    v_bogey := v_bogey * v_rand;
    v_par := 1::numeric - (v_birdie + v_bogey);

    s := v_birdie + v_par + v_bogey;
    if s > 0 then
      v_birdie := v_birdie / s;
      v_par := v_par / s;
      v_bogey := v_bogey / s;
    else
      v_birdie := 1::numeric / 3;
      v_par := 1::numeric / 3;
      v_bogey := 1::numeric / 3;
    end if;

    r := random();

    if r < v_birdie then
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

    elsif r < (v_birdie + v_par) then
      update public.sim_live_state
      set
        hole = hole + 1,
        fantasy_points = fantasy_points + 0.5,
        thru = (hole + 1)::text,
        updated_at = now()
      where player_id = sl.player_id
        and (made_cut is null or made_cut = true);

    else
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
  'One roll r vs v_birdie/v_par/v_bogey (weekend + rank + jitter); nested birdie/bogey detail; apply_cut at R2 end.';
