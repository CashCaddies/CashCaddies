create table if not exists public.founder_updates (
  id uuid primary key default gen_random_uuid(),
  message text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

insert into public.founder_updates (message)
select 'Welcome to the CashCaddies founding beta group.'
where not exists (select 1 from public.founder_updates);

alter table public.founder_updates enable row level security;

drop policy if exists "Anyone can read founder message" on public.founder_updates;
create policy "Anyone can read founder message"
on public.founder_updates
for select
to authenticated
using (true);

drop policy if exists "Senior admin edit founder message" on public.founder_updates;
create policy "Senior admin edit founder message"
on public.founder_updates
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and role = 'senior_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and role = 'senior_admin'
  )
);
