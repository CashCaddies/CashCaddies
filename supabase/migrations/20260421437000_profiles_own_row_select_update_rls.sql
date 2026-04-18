-- Own-row read/update for profiles (portal welcome flag, self-service). Idempotent.
-- Keeps existing policies such as "Admins can read profiles" and "Only owner can update founder status".

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Replace legacy name "Users update own profile" with requested policy name (same predicate).
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
