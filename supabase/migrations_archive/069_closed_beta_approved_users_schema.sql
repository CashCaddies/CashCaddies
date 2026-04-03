-- Closed beta: full approved_users shape (id, approved, notes), signup trigger copy, login RPCs, table grants/RLS.

-- 1) Extend columns (067 used email as PK only)
alter table public.approved_users add column if not exists id uuid default gen_random_uuid();
alter table public.approved_users add column if not exists approved boolean;
alter table public.approved_users add column if not exists notes text;

update public.approved_users set approved = coalesce(approved, true);
alter table public.approved_users alter column approved set default true;
alter table public.approved_users alter column approved set not null;

alter table public.approved_users alter column id set not null;

-- 2) Primary key on id; email stays unique (one-time migrate when PK is still on email from 067)
do $$
declare
  pk_on_email boolean;
begin
  select coalesce(
    bool_or(pg_get_constraintdef(c.oid) = 'PRIMARY KEY (email)'),
    false
  )
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'approved_users'
    and c.contype = 'p'
  into pk_on_email;

  if pk_on_email then
    alter table public.approved_users drop constraint approved_users_pkey;
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      where t.relname = 'approved_users'
        and c.conname = 'approved_users_email_key'
    ) then
      alter table public.approved_users
        add constraint approved_users_email_key unique (email);
    end if;
    alter table public.approved_users add primary key (id);
  end if;
end $$;

comment on table public.approved_users is
  'Closed beta allowlist: signup requires approved row; login gated via current_user_beta_approved().';

comment on column public.approved_users.approved is
  'When false, row is ignored for signup and login gate.';

-- 3) Signup enforcement (replace 067 message + require approved = true)
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
      'CLOSED_BETA: CashCaddies is currently in a closed beta. If you would like access, email CashCaddies@outlook.com'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 4) Login / server helpers (SECURITY DEFINER reads allowlist; table has no anon/authenticated policies)
create or replace function public.current_user_beta_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select exists (
        select 1
        from public.approved_users a
        where a.email = lower(trim(coalesce(auth.jwt()->>'email', '')))
          and a.approved = true
      )
    ),
    false
  );
$$;

comment on function public.current_user_beta_approved() is
  'True when JWT email matches an approved_users row with approved=true. For middleware / session gate.';

create or replace function public.is_approved_user(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_email, '')));
  jwt_mail text := lower(trim(coalesce(auth.jwt()->>'email', '')));
begin
  if v = '' then
    return false;
  end if;
  if (select auth.role()) = 'service_role' then
    return exists (
      select 1
      from public.approved_users a
      where a.email = v
        and a.approved = true
    );
  end if;
  if jwt_mail = '' or jwt_mail <> v then
    return false;
  end if;
  return exists (
    select 1
    from public.approved_users a
    where a.email = v
      and a.approved = true
  );
end;
$$;

comment on function public.is_approved_user(text) is
  'Service role: check any email. Authenticated: only when p_email matches JWT email (no cross-email probe).';

grant execute on function public.current_user_beta_approved() to authenticated;
grant execute on function public.is_approved_user(text) to authenticated, service_role;

-- 5) Safe access: clients cannot read/modify allowlist; service_role manages rows (bypasses RLS)
revoke all on table public.approved_users from public;
revoke all on table public.approved_users from anon, authenticated;

grant all on table public.approved_users to postgres;
grant all on table public.approved_users to service_role;

alter table public.approved_users enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated => deny via RLS
