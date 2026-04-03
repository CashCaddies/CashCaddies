-- Role hierarchy: user < admin < senior_admin; defaults; seed senior admins; signup default role.

-- ---------------------------------------------------------------------------
-- Column default (column exists in baseline; enforce default)
-- ---------------------------------------------------------------------------
alter table public.profiles
  alter column role set default 'user';

-- ---------------------------------------------------------------------------
-- Allowed values
-- ---------------------------------------------------------------------------
update public.profiles
set role = 'user'
where role is null or trim(role) = '';

update public.profiles
set role = 'user'
where role is not null
  and trim(role) <> ''
  and lower(trim(role)) not in ('user', 'admin', 'senior_admin');

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or lower(trim(role)) = any (array['user'::text, 'admin'::text, 'senior_admin'::text])
  );

-- ---------------------------------------------------------------------------
-- Designated senior admins (match auth.users.email)
-- ---------------------------------------------------------------------------
update public.profiles p
set role = 'senior_admin'
from auth.users u
where u.id = p.id
  and lower(trim(u.email)) in (
    'cashcaddies@outlook.com',
    'koepsell1992@gmail.com'
  );

-- ---------------------------------------------------------------------------
-- New signups: explicit role = user on insert
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
    role,
    created_at
  )
  values (
    new.id,
    new.email,
    case when v_use_generated then null else v_username end,
    0,
    'user',
    now()
  )
  on conflict (id) do update set
    email = coalesce(profiles.email, excluded.email);

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

comment on column public.profiles.role is 'Access tier: user | admin | senior_admin.';
