-- Template-driven roster validation (salary cap + per-position counts). Adds columns assumed by the spec.
-- Golf DFS may leave salary_cap / roster_requirements null or {} until multi-sport rules are configured.

alter table public.contest_templates
  add column if not exists salary_cap integer,
  add column if not exists roster_requirements jsonb not null default '{}'::jsonb;

comment on column public.contest_templates.salary_cap is
  'Optional salary budget for DFS lineups (same units as public.players.salary).';
comment on column public.contest_templates.roster_requirements is
  'JSON map of position label → required count, e.g. {"QB":1,"RB":2}.';

alter table public.players
  add column if not exists position text,
  add column if not exists salary integer;

comment on column public.players.position is
  'DFS position / role label for roster rules (sport-specific).';
comment on column public.players.salary is
  'Salary cost for cap checks (same units as contest_templates.salary_cap).';

create or replace function public.get_players_data(p_ids uuid[])
returns table (id uuid, position text, salary int)
language sql
stable
set search_path to public
as $sql$
  select
    p.id,
    p.position,
    coalesce(p.salary, 0)::int
  from public.players p
  where p.id = any (p_ids);
$sql$;

comment on function public.get_players_data(uuid[]) is
  'Returns id, position, coalesced salary for each player id in p_ids (may return fewer rows if ids missing).';

grant execute on function public.get_players_data(uuid[]) to anon, authenticated, service_role;

create or replace function public.validate_lineup_rules(
  p_contest_id uuid,
  p_lineup uuid[]
)
returns jsonb
language plpgsql
volatile
set search_path to public
as $$
declare
  v_salary_cap int;
  v_requirements jsonb;
  v_total_salary bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_player record;
  v_key text;
  v_required int;
  v_n_lineup int;
  v_n_distinct int;
  v_n_rows int;
begin
  if p_lineup is null then
    return jsonb_build_object('ok', false, 'error', 'EMPTY_LINEUP');
  end if;

  v_n_lineup := coalesce(cardinality(p_lineup), 0);
  select count(distinct x)::int
  into v_n_distinct
  from unnest(p_lineup) as x;

  if v_n_lineup <> v_n_distinct then
    return jsonb_build_object('ok', false, 'error', 'DUPLICATE_PLAYERS');
  end if;

  select ct.salary_cap, ct.roster_requirements
  into v_salary_cap, v_requirements
  from public.contests c
  inner join public.contest_templates ct on ct.id = c.template_id
  where c.id = p_contest_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'CONTEST_TEMPLATE_NOT_FOUND');
  end if;

  select count(*)::int
  into v_n_rows
  from public.get_players_data(p_lineup);

  if v_n_rows <> v_n_lineup then
    return jsonb_build_object('ok', false, 'error', 'UNKNOWN_PLAYER');
  end if;

  for v_player in
    select g.id, g.position, g.salary from public.get_players_data(p_lineup) g
  loop
    v_total_salary := v_total_salary + coalesce(v_player.salary, 0);

    v_key := coalesce(nullif(trim(v_player.position), ''), 'UNKNOWN');
    v_counts := jsonb_set(
      v_counts,
      array[v_key],
      to_jsonb(coalesce((v_counts ->> v_key)::int, 0) + 1),
      true
    );
  end loop;

  if v_salary_cap is not null and v_total_salary > v_salary_cap then
    return jsonb_build_object('ok', false, 'error', 'SALARY_CAP_EXCEEDED');
  end if;

  if v_requirements is not null and v_requirements <> '{}'::jsonb then
    for v_key, v_required in
      select t.key, t.value::int
      from jsonb_each_text(v_requirements) as t (key, value)
    loop
      if coalesce((v_counts ->> v_key)::int, 0) <> v_required then
        return jsonb_build_object(
          'ok', false,
          'error', 'INVALID_ROSTER',
          'position', v_key
        );
      end if;
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.validate_lineup_rules(uuid, uuid[]) is
  'Validates duplicate-free lineup against contest_templates (via contests.template_id): salary cap and roster_requirements.';

grant execute on function public.validate_lineup_rules(uuid, uuid[]) to anon, authenticated, service_role;
