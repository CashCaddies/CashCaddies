-- 1–3: game start + lock helpers on public.players (tournament field / player identity).
-- Lineups use lineup_players.golfer_id → public.golfers, so golfers also get game_start_at for snapshots.
-- 4–5: locked_players jsonb on contest_entries; snapshot resolves roster via lineup_id (no contest_entries.lineup column).

alter table public.players
  add column if not exists game_start_at timestamptz;

create index if not exists idx_players_game_start
  on public.players (game_start_at);

alter table public.golfers
  add column if not exists game_start_at timestamptz;

create index if not exists idx_golfers_game_start
  on public.golfers (game_start_at);

create or replace function public.is_player_locked(p_player_id uuid)
returns boolean
language plpgsql
stable
set search_path to public
as $$
declare
  v_start_time timestamptz;
begin
  select p.game_start_at
  into v_start_time
  from public.players p
  where p.id = p_player_id;

  if v_start_time is null then
    return false;
  end if;

  return now() >= v_start_time;
end;
$$;

create or replace function public.get_locked_players(p_player_ids uuid[])
returns table (player_id uuid, is_locked boolean)
language sql
stable
set search_path to public
as $fn$
  select
    p.id,
    (p.game_start_at is not null and now() >= p.game_start_at)
  from public.players p
  where p.id = any (p_player_ids);
$fn$;

alter table public.contest_entries
  add column if not exists locked_players jsonb default '{}'::jsonb;

comment on column public.contest_entries.locked_players is
  'Snapshot of lock flags per roster golfer id (uuid string keys) at snapshot time; from golfers.game_start_at.';

create or replace function public.snapshot_entry_locks(p_entry_id uuid)
returns void
language plpgsql
volatile
set search_path to public
as $$
declare
  v_lineup_id uuid;
begin
  select ce.lineup_id
  into v_lineup_id
  from public.contest_entries ce
  where ce.id = p_entry_id;

  if v_lineup_id is null then
    update public.contest_entries ce
    set locked_players = '{}'::jsonb
    where ce.id = p_entry_id;
    return;
  end if;

  update public.contest_entries ce
  set locked_players = coalesce(
    (
      select jsonb_object_agg(
        g.id::text,
        (g.game_start_at is not null and now() >= g.game_start_at)
      )
      from public.lineup_players lp
      inner join public.golfers g on g.id = lp.golfer_id
      where lp.lineup_id = v_lineup_id
    ),
    '{}'::jsonb
  )
  where ce.id = p_entry_id;
end;
$$;

comment on function public.is_player_locked(uuid) is
  'True when players.game_start_at is set and now() is past that instant.';
comment on function public.get_locked_players(uuid[]) is
  'Bulk lock flags for public.players ids (tournament field).';
comment on function public.snapshot_entry_locks(uuid) is
  'Fills contest_entries.locked_players from lineup roster (golfers) keyed by golfer id.';

grant execute on function public.is_player_locked(uuid) to anon, authenticated, service_role;
grant execute on function public.get_locked_players(uuid[]) to anon, authenticated, service_role;
grant execute on function public.snapshot_entry_locks(uuid) to anon, authenticated, service_role;
