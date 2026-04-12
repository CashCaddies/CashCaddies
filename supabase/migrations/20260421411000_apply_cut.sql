-- Mark made_cut / is_cut after R2 (36 holes) using cumulative strokes (strict top 65).
-- sim_live_state has hole + strokes, not round / total_score.

create or replace function public.apply_cut()
returns void
language plpgsql
volatile
security definer
set search_path to public
as $$
begin
  -- Lockstep sim: everyone shares the same hole count; min(hole) >= 36 means R2 complete.
  if (select coalesce(min(hole), 0) from public.sim_live_state) < 36 then
    return;
  end if;

  with ranked as (
    select
      player_id,
      row_number() over (order by strokes asc, player_id asc) as rnk
    from public.sim_live_state
  )
  update public.sim_live_state s
  set
    made_cut = (r.rnk <= 65),
    is_cut = (r.rnk > 65)
  from ranked r
  where s.player_id = r.player_id;
end;
$$;

comment on function public.apply_cut() is
  'When min(hole) >= 36, sets made_cut/is_cut from cumulative strokes (strict top 65; not PGA ties-at-line).';

revoke all on function public.apply_cut() from public;

grant execute on function public.apply_cut() to authenticated, service_role;
