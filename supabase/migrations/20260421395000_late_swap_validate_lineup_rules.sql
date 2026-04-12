-- Extend get_players_data so validate_lineup_rules works for lineup golfer ids (public.golfers) as well as public.players.
-- late_swap_player: simulate swap in uuid[], validate_lineup_rules before persisting to lineup_players.

create or replace function public.get_players_data(p_ids uuid[])
returns table (id uuid, position text, salary int)
language sql
stable
set search_path to public
as $sql$
  select
    m.id,
    m.position,
    m.salary
  from (
    select
      p.id,
      coalesce(nullif(trim(p.position), ''), 'UNKNOWN')::text as position,
      coalesce(p.salary, 0)::int as salary
    from public.players p
    where p.id = any (p_ids)
    union all
    select
      g.id,
      coalesce(nullif(trim(g.position::text), ''), 'UNKNOWN')::text as position,
      coalesce(g.salary, 0)::int as salary
    from public.golfers g
    where g.id = any (p_ids)
      and not exists (select 1 from public.players p2 where p2.id = g.id)
  ) m;
$sql$;

comment on function public.get_players_data(uuid[]) is
  'Roster salary/position for ids: players row wins over golfers when both exist; else golfers only.';

create or replace function public.late_swap_player(
  p_entry_id uuid,
  p_user_id uuid,
  p_out_player uuid,
  p_in_player uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  v_lineup_id uuid;
  v_contest_id uuid;
  v_lineup uuid[];
  v_index int;
  v_lp_id uuid;
  v_validation jsonb;
  v_new_lineup jsonb;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  select ce.lineup_id, ce.contest_id
  into v_lineup_id, v_contest_id
  from public.contest_entries ce
  where ce.id = p_entry_id
    and ce.user_id = p_user_id
  for update;

  if v_lineup_id is null then
    return jsonb_build_object('ok', false, 'error', 'ENTRY_NOT_FOUND');
  end if;

  perform 1
  from public.lineups l
  where l.id = v_lineup_id
  for update;

  select array_agg(lp.golfer_id order by lp.slot_index, lp.id)
  into v_lineup
  from public.lineup_players lp
  where lp.lineup_id = v_lineup_id;

  if v_lineup is null or coalesce(array_length(v_lineup, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_LINEUP');
  end if;

  v_validation := public.validate_late_swap(p_entry_id, p_out_player, p_in_player);
  if coalesce((v_validation->>'ok')::boolean, false) is distinct from true then
    return v_validation;
  end if;

  if p_out_player is not distinct from p_in_player then
    return jsonb_build_object('ok', false, 'error', 'SAME_PLAYER');
  end if;

  if exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = v_lineup_id
      and lp.golfer_id = p_in_player
      and lp.golfer_id is distinct from p_out_player
  ) then
    return jsonb_build_object('ok', false, 'error', 'IN_PLAYER_ALREADY_IN_LINEUP');
  end if;

  select t.i::int
  into v_index
  from unnest(v_lineup) with ordinality as t (gid, i)
  where t.gid = p_out_player
  limit 1;

  if v_index is null then
    return jsonb_build_object('ok', false, 'error', 'PLAYER_NOT_IN_LINEUP');
  end if;

  v_lineup[v_index] := p_in_player;

  if v_contest_id is not null then
    v_validation := public.validate_lineup_rules(v_contest_id, v_lineup);
    if coalesce((v_validation->>'ok')::boolean, false) is distinct from true then
      return v_validation;
    end if;
  end if;

  select lp.id
  into v_lp_id
  from public.lineup_players lp
  where lp.lineup_id = v_lineup_id
    and lp.golfer_id = p_out_player
  for update;

  if v_lp_id is null then
    return jsonb_build_object('ok', false, 'error', 'PLAYER_NOT_IN_LINEUP');
  end if;

  update public.lineup_players lp
  set golfer_id = p_in_player
  where lp.id = v_lp_id;

  select coalesce(
    (
      select jsonb_agg(lp2.golfer_id order by lp2.slot_index, lp2.id)
      from public.lineup_players lp2
      where lp2.lineup_id = v_lineup_id
    ),
    '[]'::jsonb
  )
  into v_new_lineup;

  return jsonb_build_object(
    'ok', true,
    'new_lineup', v_new_lineup
  );
end;
$$;

comment on function public.late_swap_player(uuid, uuid, uuid, uuid) is
  'Locks entry/lineup; validates locks + full validate_lineup_rules on post-swap roster; updates lineup_players.';
