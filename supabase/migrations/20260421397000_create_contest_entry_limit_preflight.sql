-- max_entries_per_user: already present on public.contests (baseline); ALTER is idempotent for older DBs.
-- create_contest_entry: locks contest + enforces per-user entry cap (race-safe). Does NOT insert contest_entries —
-- CashCaddies requires wallet + lineup_id via create_contest_entry_atomic / enter_contest_atomic. p_lineup reserved for callers / future validation.

alter table public.contests
  add column if not exists max_entries_per_user integer default 1;

create or replace function public.create_contest_entry(
  p_user_id uuid,
  p_contest_id uuid,
  p_lineup uuid[]
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to public
as $$
declare
  v_count int;
  v_max int;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null or p_contest_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_arguments');
  end if;

  select greatest(1, coalesce(c.max_entries_per_user, 1))
  into v_max
  from public.contests c
  where c.id = p_contest_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'CONTEST_NOT_FOUND');
  end if;

  select count(*)::int
  into v_count
  from public.contest_entries ce
  where ce.contest_id = p_contest_id
    and ce.user_id = p_user_id;

  if v_count >= v_max then
    return jsonb_build_object(
      'ok', false,
      'error', 'ENTRY_LIMIT_REACHED'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'message', 'Under per-user entry limit. Create the ledger row via enter_contest_atomic or create_contest_entry_atomic with lineup_id (roster lives in lineups + lineup_players).'
  );
end;
$$;

comment on function public.create_contest_entry(uuid, uuid, uuid[]) is
  'FOR UPDATE contest + count contest_entries; ENTRY_LIMIT_REACHED when at max_entries_per_user. Does not insert.';

revoke all on function public.create_contest_entry(uuid, uuid, uuid[]) from public;

grant execute on function public.create_contest_entry(uuid, uuid, uuid[]) to authenticated, service_role;
