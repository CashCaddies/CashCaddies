-- User-facing closed-beta signup message: public contact email (additive; replaces prior string only).

create or replace function public.enforce_beta_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.approved_users a
    where a.email = lower(trim(new.email))
      and a.approved = true
  ) then
    raise exception
      'CLOSED_BETA: CashCaddies is currently in a closed beta. If you would like access, email contact@cashcaddies.com'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
