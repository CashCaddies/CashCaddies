-- Signup trigger: explicitly deny product access until admin approval (no reliance on column default alone).
-- Email/welcome flows do not touch beta_access; this keeps DB intent obvious.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local text;
  v_username text;
begin
  v_local := lower(replace(split_part(coalesce(NEW.email, ''), '@', 1), '.', '_'));
  v_local := regexp_replace(v_local, '[^a-z0-9_]', '_', 'g');
  if length(v_local) > 20 then
    v_local := left(v_local, 20);
  end if;

  if length(v_local) >= 3
     and v_local ~ '^[a-z0-9_]{3,20}$'
     and not exists (
       select 1
       from public.profiles p
       where lower(p.username) = v_local
         and p.id is distinct from NEW.id
     ) then
    v_username := v_local;
  else
    v_username := null;
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    beta_user,
    beta_status,
    beta_access
  )
  values (
    NEW.id,
    NEW.email,
    v_username,
    false,
    'pending',
    false
  )
  on conflict (id) do nothing;

  return NEW;
end;
$$;

alter function public.handle_new_user() owner to postgres;

comment on function public.handle_new_user() is
  'After insert on auth.users: upsert profiles with beta_access false until admin approval.';

-- Backfill: missing profiles get explicit no-access flags (username filled by profiles_username_before_insert).
insert into public.profiles (id, email, beta_user, beta_status, beta_access)
select u.id, u.email, false, 'pending', false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
