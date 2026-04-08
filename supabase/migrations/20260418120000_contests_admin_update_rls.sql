-- Allow admins to UPDATE contests (e.g. draft → open publish). INSERT existed; UPDATE had no policy.

drop policy if exists "Admins can update contests" on public.contests;

create policy "Admins can update contests"
on public.contests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(trim(coalesce(profiles.role, ''))) in ('admin', 'senior_admin', 'founder')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(trim(coalesce(profiles.role, ''))) in ('admin', 'senior_admin', 'founder')
  )
);
