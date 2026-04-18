-- Founder flag: only owner account may change is_founder. Self-serve updates stay on "Users update own profile".

drop policy if exists "Allow update profiles" on public.profiles;

-- Owner JWT may update any profile row (admin UI sets is_founder on other users).
-- Uses JWT email claim (Supabase); equivalent to auth.email() where available.
create policy "Only owner can update founder status"
  on public.profiles
  for update
  to authenticated
  using (
    (auth.jwt()->>'email') = 'cashcaddies@outlook.com'
  )
  with check (
    (auth.jwt()->>'email') = 'cashcaddies@outlook.com'
  );

-- Block non-owner users from toggling is_founder on their own row (RLS OR allows self-update policy).
create or replace function public.profiles_enforce_is_founder_owner_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email constant text := 'cashcaddies@outlook.com';
  actor_email text;
begin
  if new.is_founder is not distinct from old.is_founder then
    return new;
  end if;

  select u.email into actor_email
  from auth.users u
  where u.id = auth.uid();

  if actor_email is null or lower(actor_email) <> lower(owner_email) then
    raise exception 'is_founder may only be changed by the owner account';
  end if;

  return new;
end;
$$;

alter function public.profiles_enforce_is_founder_owner_only() owner to postgres;

drop trigger if exists profiles_enforce_is_founder_owner_only on public.profiles;

create trigger profiles_enforce_is_founder_owner_only
  before update of is_founder on public.profiles
  for each row
  execute function public.profiles_enforce_is_founder_owner_only();

comment on function public.profiles_enforce_is_founder_owner_only() is
  'Non-owner sessions cannot change profiles.is_founder even on their own row; complements RLS.';
