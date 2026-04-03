-- Invite-only beta: only emails in public.approved_users may create auth.users rows.

create table if not exists public.approved_users (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint approved_users_email_normalized check (email = lower(trim(email)))
);

comment on table public.approved_users is
  'Beta allowlist: signup is blocked unless email exists here (see trigger on auth.users).';

create or replace function public.approved_users_normalize_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists approved_users_normalize_before on public.approved_users;
create trigger approved_users_normalize_before
  before insert or update on public.approved_users
  for each row
  execute function public.approved_users_normalize_email();

alter table public.approved_users enable row level security;

grant all on table public.approved_users to postgres;
grant all on table public.approved_users to service_role;

-- Enforce allowlist before new auth user row is written.
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
  ) then
    raise exception 'CashCaddies is currently invite-only beta.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beta_email_allowlist_before_insert on auth.users;
create trigger enforce_beta_email_allowlist_before_insert
  before insert on auth.users
  for each row
  execute function public.enforce_beta_email_allowlist();

comment on function public.enforce_beta_email_allowlist() is
  'Blocks auth signups when email is not in approved_users.';

-- After migrate: add allowed emails (normalized automatically on insert), e.g.:
-- insert into public.approved_users (email) values ('you@example.com');
