-- Apply a referral code for the current user: set profiles.referred_by and append referrals row.

create or replace function public.apply_referral(p_user_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_referrer_id uuid;
  v_code text;
  v_prev uuid;
  v_n int;
begin
  if coalesce((auth.jwt()->>'role'), '') is distinct from 'service_role' then
    if auth.uid() is distinct from p_user_id then
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
  end if;

  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_user');
  end if;

  v_code := nullif(lower(btrim(coalesce(p_code, ''))), '');
  if v_code is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select id into v_referrer_id
  from public.profiles
  where referral_code is not null
    and lower(btrim(referral_code)) = v_code;

  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_referrer_id = p_user_id then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  select referred_by into v_prev from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_not_found');
  end if;

  if v_prev is not null then
    if v_prev = v_referrer_id then
      insert into public.referrals (referrer_id, referred_id)
      values (v_referrer_id, p_user_id)
      on conflict (referrer_id, referred_id) do nothing;
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end if;

  update public.profiles
  set referred_by = v_referrer_id
  where id = p_user_id
    and referred_by is null;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    select referred_by into v_prev from public.profiles where id = p_user_id;
    if v_prev = v_referrer_id then
      insert into public.referrals (referrer_id, referred_id)
      values (v_referrer_id, p_user_id)
      on conflict (referrer_id, referred_id) do nothing;
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (v_referrer_id, p_user_id)
  on conflict (referrer_id, referred_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.apply_referral(uuid, text) is
  'Set profiles.referred_by from referral_code and record public.referrals. Caller must be p_user_id or service_role.';

revoke all on function public.apply_referral(uuid, text) from public;

grant execute on function public.apply_referral(uuid, text) to authenticated;
grant execute on function public.apply_referral(uuid, text) to service_role;
