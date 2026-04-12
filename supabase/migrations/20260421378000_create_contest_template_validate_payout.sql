-- Enforce payout JSON sums to 100% before inserting a template (requires validate_payout_structure).

create or replace function public.create_contest_template(
  p_name text,
  p_description text,
  p_entry_fee_cents integer,
  p_max_entries integer,
  p_max_entries_per_user integer,
  p_prize_pool_type text,
  p_prize_pool_cents integer,
  p_rake_percent numeric,
  p_payout_structure jsonb,
  p_sport text
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_template public.contest_templates;
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

  if p_name is null or length(trim(p_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  if p_max_entries is null or p_max_entries < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_max_entries');
  end if;

  if p_max_entries_per_user is null or p_max_entries_per_user < 1 then
    return jsonb_build_object('ok', false, 'error', 'invalid_max_entries_per_user');
  end if;

  if p_entry_fee_cents is null or p_entry_fee_cents < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_entry_fee_cents');
  end if;

  if p_prize_pool_type is null or length(trim(p_prize_pool_type)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_prize_pool_type');
  end if;

  if p_sport is null or length(trim(p_sport)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_sport');
  end if;

  if not public.validate_payout_structure(p_payout_structure) then
    raise exception 'Invalid payout structure (must sum to 100)';
  end if;

  insert into public.contest_templates (
    name,
    description,
    entry_fee_cents,
    max_entries,
    max_entries_per_user,
    prize_pool_type,
    prize_pool_cents,
    rake_percent,
    payout_structure,
    sport
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    p_entry_fee_cents,
    p_max_entries,
    p_max_entries_per_user,
    trim(p_prize_pool_type),
    p_prize_pool_cents,
    p_rake_percent,
    coalesce(p_payout_structure, '[]'::jsonb),
    lower(trim(p_sport))
  )
  returning * into v_template;

  return jsonb_build_object('ok', true, 'template', to_jsonb(v_template));
end;
$$;

comment on function public.create_contest_template(
  text, text, integer, integer, integer, text, integer, numeric, jsonb, text
) is 'Insert contest_templates; payout_structure must pass validate_payout_structure. Admin or service_role.';
