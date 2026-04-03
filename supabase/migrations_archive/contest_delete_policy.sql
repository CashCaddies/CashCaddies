drop policy if exists "Admins delete contests" on public.contests;

create policy "Admins delete contests"
on public.contests
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and role in ('admin', 'senior_admin')
  )
);
