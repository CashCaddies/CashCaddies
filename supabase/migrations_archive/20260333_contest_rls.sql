alter table public.contests enable row level security;

drop policy if exists "Admins can create contests" on public.contests;
create policy "Admins can create contests"
on public.contests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can view contests" on public.contests;
create policy "Admins can view contests"
on public.contests
for select
to authenticated
using (true);
