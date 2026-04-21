-- Signup: canonical gate is beta_status; omit legacy beta_access column from insert.
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
    beta_status
  )
  values (
    NEW.id,
    NEW.email,
    v_username,
    false,
    'pending'
  )
  on conflict (id) do nothing;

  return NEW;
end;
$$;

alter function public.handle_new_user() owner to postgres;

comment on function public.handle_new_user() is
  'After insert on auth.users: profiles row with beta_status pending until admin approval.';
