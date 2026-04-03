-- Profile creation: copy auth email, username from metadata or generated handle,
-- wallet via account_balance (wallet_balance is generated), ON CONFLICT fill email,
-- sync email on auth.users updates, backfill null emails, admin SELECT for accurate counts.

-- ---------------------------------------------------------------------------
-- New user → public.profiles (SECURITY DEFINER bypasses RLS)
-- wallet_balance is GENERATED from account_balance — set account_balance = 0.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta text;
  v_norm text;
  v_username text;
  v_use_generated boolean;
begin
  v_meta := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  v_use_generated := true;
  v_username := null;

  if v_meta is not null then
    v_norm := lower(regexp_replace(v_meta, '[^a-z0-9_]', '_', 'g'));
    if length(v_norm) > 20 then
      v_norm := left(v_norm, 20);
    end if;
    if length(v_norm) >= 3 and v_norm ~ '^[a-z0-9_]{3,20}$' then
      if not exists (
        select 1
        from public.profiles p
        where lower(p.username) = lower(v_norm)
          and p.id is distinct from new.id
      ) then
        v_username := v_norm;
        v_use_generated := false;
      end if;
    end if;
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    account_balance,
    created_at
  )
  values (
    new.id,
    new.email,
    case when v_use_generated then null else v_username end,
    0,
    now()
  )
  on conflict (id) do update set
    email = coalesce(profiles.email, excluded.email);

  -- Fallback: row existed or email still null (e.g. race) — pull from auth.users
  update public.profiles p
  set email = au.email
  from auth.users au
  where au.id = new.id
    and p.id = new.id
    and p.email is null
    and au.email is not null;

  return new;
end;
$$;

alter function public.handle_new_user_profile() owner to postgres;

-- ---------------------------------------------------------------------------
-- When auth email is set/changed, fill profiles.email if still NULL
-- ---------------------------------------------------------------------------
create or replace function public.handle_auth_user_email_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null
     and coalesce(old.email, '') is distinct from coalesce(new.email, '') then
    update public.profiles p
    set email = new.email
    where p.id = new.id
      and p.email is null;
  end if;
  return new;
end;
$$;

alter function public.handle_auth_user_email_sync() owner to postgres;

-- ---------------------------------------------------------------------------
-- Triggers on auth.users (names aligned with historical migrations)
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

drop trigger if exists on_auth_user_updated_email_profile on auth.users;

create trigger on_auth_user_updated_email_profile
  after update of email on auth.users
  for each row
  execute function public.handle_auth_user_email_sync();

-- ---------------------------------------------------------------------------
-- Backfill: profiles.email from auth.users where missing
-- ---------------------------------------------------------------------------
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null
  and u.email is not null;

-- ---------------------------------------------------------------------------
-- Admins / senior admins: SELECT all profiles (fixes head counts & listings)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can select all profiles" on public.profiles;

create policy "Admins can select all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles ap
      where ap.id = (select auth.uid())
        and ap.role in ('admin', 'senior_admin')
    )
  );

comment on function public.handle_new_user_profile() is
  'After insert on auth.users: upsert profiles with id, email, username (metadata or generated), account_balance 0; ON CONFLICT fill email if null.';

comment on function public.handle_auth_user_email_sync() is
  'After auth.users email change: set profiles.email when profile email is still null.';
