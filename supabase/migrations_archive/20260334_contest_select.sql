drop policy if exists "Users can view contests" on public.contests;

create policy "Users can view contests"
on public.contests
for select
to authenticated
using (true);
