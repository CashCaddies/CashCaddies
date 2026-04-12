-- current_entries: may already exist from contests_tournament_link; keep idempotent.
alter table public.contests
  add column if not exists current_entries integer not null default 0;

update public.contests
set current_entries = coalesce(current_entries, 0)
where current_entries is null;

alter table public.contests
  alter column current_entries set default 0;

alter table public.contests
  alter column current_entries set not null;

-- max_entries: backfill nulls before NOT NULL
update public.contests
set max_entries = 100
where max_entries is null;

alter table public.contests
  alter column max_entries set not null;

-- Canonical fee in cents (legacy entry_fee / entry_fee_usd treated as whole USD).
alter table public.contests
  add column if not exists entry_fee_cents integer;

update public.contests
set entry_fee_cents = greatest(
  0,
  round(coalesce(entry_fee_usd, entry_fee, 0)::numeric * 100)::integer
)
where entry_fee_cents is null;

alter table public.contests
  alter column entry_fee_cents set not null;

alter table public.contests
  alter column entry_fee_cents set default 0;

-- Keep spawn_contest_from_template aligned with contests.entry_fee_cents.
create or replace function public.spawn_contest_from_template(
  p_template_id uuid,
  p_slate_id uuid,
  p_start_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_template public.contest_templates;
  v_contest public.contests;
  v_fee_usd integer;
  v_prize_usd integer;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role, ''))) in ('admin', 'senior_admin', 'founder')
    ) then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_template_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_template_id');
  end if;

  if p_start_time is null then
    return jsonb_build_object('ok', false, 'error', 'missing_start_time');
  end if;

  select *
  into v_template
  from public.contest_templates t
  where t.id = p_template_id
    and t.is_active = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'template_not_found_or_inactive');
  end if;

  if lower(trim(coalesce(v_template.prize_pool_type, ''))) = 'gpp' then
    v_template.prize_pool_cents :=
      round(
        v_template.entry_fee_cents::numeric
        * v_template.max_entries::numeric
        * (1 - coalesce(v_template.rake_percent, 0)::numeric / 100.0)
      )::integer;
  end if;

  v_fee_usd := greatest(0, round(v_template.entry_fee_cents::numeric / 100.0))::integer;
  v_prize_usd := greatest(
    0,
    round(coalesce(v_template.prize_pool_cents, 0)::numeric / 100.0)
  )::integer;

  insert into public.contests (
    name,
    entry_fee,
    entry_fee_usd,
    entry_fee_cents,
    max_entries,
    max_entries_per_user,
    prize_pool,
    rake_percent,
    payout_structure,
    sport,
    slate_id,
    starts_at,
    start_time,
    entries_open_at,
    status,
    entry_count,
    current_entries,
    created_by,
    template_id
  )
  values (
    v_template.name,
    v_fee_usd,
    v_fee_usd,
    greatest(0, v_template.entry_fee_cents),
    v_template.max_entries,
    v_template.max_entries_per_user,
    v_prize_usd,
    v_template.rake_percent,
    coalesce(v_template.payout_structure, '[]'::jsonb),
    v_template.sport,
    p_slate_id,
    p_start_time::timestamp,
    p_start_time,
    now(),
    'filling',
    0,
    0,
    auth.uid(),
    p_template_id
  )
  returning * into v_contest;

  return jsonb_build_object(
    'ok', true,
    'contest', to_jsonb(v_contest)
  );
end;
$$;

comment on function public.spawn_contest_from_template(uuid, uuid, timestamptz) is
  'Spawn contest from template; sets entry_fee_cents; GPP prize_pool_cents = entry_fee_cents * max_entries * (1 - rake%).';
