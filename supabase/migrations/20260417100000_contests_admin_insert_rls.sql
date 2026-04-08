-- Allow admin, senior_admin, and founder roles to insert contests.
-- Baseline only allowed profiles.role = 'admin', which blocked senior_admin users.
-- INSERT RLS must use WITH CHECK (USING is not used for INSERT in PostgreSQL).

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or lower(trim(role)) = any (
      array['user'::text, 'admin'::text, 'senior_admin'::text, 'founder'::text]
    )
  );

drop policy if exists "Admins can create contests" on public.contests;
drop policy if exists "Admins can insert contests" on public.contests;

create policy "Admins can insert contests"
on public.contests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(trim(coalesce(profiles.role, ''))) in ('admin', 'senior_admin', 'founder')
  )
);

drop policy if exists "Admins can view contests" on public.contests;

create policy "Admins can view contests"
on public.contests
for select
to authenticated
using (true);
