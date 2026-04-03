-- Require one insured golfer on each contest entry.

alter table public.contest_entries
  add column if not exists insured_golfer_id uuid references public.golfers (id) on delete restrict;

comment on column public.contest_entries.insured_golfer_id is
  'Required golfer selected for CashCaddies Safety Coverage when entering a contest.';

create or replace function public.enforce_contest_entry_insured_golfer()
returns trigger
language plpgsql
as $$
begin
  if new.insured_golfer_id is null then
    raise exception 'CashCaddies Safety Coverage requires selecting one protected golfer (insured_golfer_id required).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_contest_entry_insured_golfer on public.contest_entries;
create constraint trigger enforce_contest_entry_insured_golfer
after insert or update on public.contest_entries
deferrable initially deferred
for each row
execute function public.enforce_contest_entry_insured_golfer();

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text,
  p_insured_golfer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_entry_id uuid;
begin
  if p_insured_golfer_id is null then
    raise exception 'CashCaddies Safety Coverage requires selecting one protected golfer (insured_golfer_id required).'
      using errcode = 'P0001';
  end if;

  v_result := public.create_contest_entry_atomic(
    p_user_id,
    p_contest_id,
    p_entry_fee,
    p_protection_fee,
    p_total_paid,
    p_protection_enabled,
    p_lineup_id,
    p_contest_name
  );

  if coalesce((v_result ->> 'ok')::boolean, false) = false then
    return v_result;
  end if;

  v_entry_id := nullif(v_result ->> 'contest_entry_id', '')::uuid;
  if v_entry_id is null then
    raise exception 'Could not determine contest entry id for insured golfer update.'
      using errcode = 'P0001';
  end if;

  update public.contest_entries
  set insured_golfer_id = p_insured_golfer_id
  where id = v_entry_id;

  return v_result;
end;
$$;

grant execute on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, uuid
) to authenticated;
