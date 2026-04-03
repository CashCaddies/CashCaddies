alter table public.profiles
  add column if not exists beta_status text;

alter table public.profiles
  alter column beta_status set default 'pending';

alter table public.profiles
  alter column beta_user set default false;

alter table public.profiles
  alter column founding_tester set default false;

update public.profiles
set
  beta_status = coalesce(nullif(trim(beta_status), ''), 'pending'),
  beta_user = coalesce(beta_user, false),
  founding_tester = coalesce(founding_tester, false);

create or replace function public.enforce_beta_approval_senior_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if (new.beta_status is distinct from old.beta_status)
     or (new.beta_user is distinct from old.beta_user) then
    if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
      return new;
    end if;

    if auth.uid() is null then
      raise exception 'Unauthorized beta approval update.';
    end if;

    select p.role into actor_role
    from public.profiles p
    where p.id = auth.uid()
    limit 1;

    if coalesce(lower(actor_role), '') <> 'senior_admin' then
      raise exception 'Only senior_admin can approve or reject beta users.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_beta_approval_senior_admin on public.profiles;
create trigger trg_enforce_beta_approval_senior_admin
before update on public.profiles
for each row
execute function public.enforce_beta_approval_senior_admin();
