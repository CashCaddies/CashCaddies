-- Config table for flags that cannot use ALTER DATABASE on Supabase-hosted Postgres.
-- add_test_funds reads allow_test_wallet_funding here; missing or non-true = disabled.

create table if not exists public.app_config (
  key text primary key,
  value text not null
);

comment on table public.app_config is
  'Application key/value flags (e.g. allow_test_wallet_funding). Not exposed to PostgREST clients when RLS has no policies.';

insert into public.app_config (key, value)
values ('allow_test_wallet_funding', 'true')
on conflict (key) do nothing;

alter table public.app_config enable row level security;

-- Deny direct access for API roles; SECURITY DEFINER functions run as owner and can read.
revoke all on table public.app_config from public;
revoke all on table public.app_config from anon, authenticated;

create or replace function public.add_test_funds(p_user_id uuid, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_bal numeric;
  v_allow text;
begin
  select c.value
    into v_allow
  from public.app_config c
  where c.key = 'allow_test_wallet_funding';

  if v_allow is null or lower(trim(v_allow)) is distinct from 'true' then
    raise exception
      'Test wallet funding is disabled (app_config.allow_test_wallet_funding is not true).'
      using errcode = 'P0001';
  end if;

  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'You can only add test funds to your own account.'
      using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if p_amount > 10000 then
    raise exception 'Amount exceeds maximum for test funding.'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = p_user_id
  returning p.account_balance into v_new_bal;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    p_amount,
    'test_credit',
    format('Development test wallet credit ($%s)', p_amount::text)
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_bal
  );
end;
$$;

comment on function public.add_test_funds(uuid, numeric) is
  'Dev-only: credits account_balance and inserts test_credit when app_config.allow_test_wallet_funding = true.';

revoke all on function public.add_test_funds(uuid, numeric) from public;
grant execute on function public.add_test_funds(uuid, numeric) to authenticated;
