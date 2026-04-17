-- Atomic lobby entry: `supabase.rpc("enter_contest", { p_contest_id })`.
-- Inserts `contest_entries`; `contest_entries_sync_entry_count` + `sync_contest_entry_count` keep `current_entries` in sync.

create or replace function public.enter_contest(p_contest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_next int;
  v_cur int;
  v_max int;
  v_max_per_user int;
  v_current int;
  v_status text;
  v_start timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated',
      'message', 'Sign in to enter contests.'
    );
  end if;

  if p_contest_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'missing_contest',
      'message', 'Invalid contest.'
    );
  end if;

  select
    c.max_entries,
    c.max_entries_per_user,
    coalesce(c.current_entries, 0),
    lower(trim(coalesce(c.status, ''))),
    coalesce(c.start_time, c.starts_at)
  into v_max, v_max_per_user, v_current, v_status, v_start
  from public.contests c
  where c.id = p_contest_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'contest_not_found',
      'message', 'Contest not found.'
    );
  end if;

  if exists (
    select 1
    from public.contest_entries e
    where e.user_id = v_uid
      and e.contest_id = p_contest_id
  ) then
    perform public.sync_contest_entry_count(p_contest_id::text);
    select coalesce(ct.current_entries, 0)
    into v_cur
    from public.contests ct
    where ct.id = p_contest_id;

    return jsonb_build_object(
      'ok', true,
      'current_entries', coalesce(v_cur, 0),
      'message', 'already_entered'
    );
  end if;

  if v_current >= greatest(1, coalesce(v_max, 1)) then
    return jsonb_build_object(
      'ok', false,
      'error', 'contest_full',
      'message', 'This contest is full.'
    );
  end if;

  if v_status is distinct from 'filling' then
    return jsonb_build_object(
      'ok', false,
      'error', 'contest_not_open',
      'message', 'Entries are not open for this contest.',
      'status', v_status
    );
  end if;

  if v_start is not null and now() >= v_start then
    return jsonb_build_object(
      'ok', false,
      'error', 'contest_locked',
      'message', 'This contest has started; entries are closed.'
    );
  end if;

  select coalesce(max(e.entry_number), 0) + 1
  into v_next
  from public.contest_entries e
  where e.user_id = v_uid
    and e.contest_id = p_contest_id;

  if v_next > greatest(1, coalesce(v_max_per_user, 1)) then
    return jsonb_build_object(
      'ok', false,
      'error', 'entry_limit_reached',
      'message', 'You have reached the max entries for this contest.'
    );
  end if;

  insert into public.contest_entries (user_id, contest_id, entry_number)
  values (v_uid, p_contest_id, v_next);

  perform public.sync_contest_entry_count(p_contest_id::text);

  select coalesce(ct.current_entries, 0)
  into v_cur
  from public.contests ct
  where ct.id = p_contest_id;

  return jsonb_build_object(
    'ok', true,
    'current_entries', coalesce(v_cur, 0)
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', sqlstate,
      'message', coalesce(sqlerrm, 'Unable to enter contest.')
    );
end;
$$;

comment on function public.enter_contest(uuid) is
  'Lobby: authenticated user enters contest; returns { ok, current_entries } or { ok:false, message }.';

revoke all on function public.enter_contest(uuid) from public;
grant execute on function public.enter_contest(uuid) to authenticated;
grant execute on function public.enter_contest(uuid) to service_role;
