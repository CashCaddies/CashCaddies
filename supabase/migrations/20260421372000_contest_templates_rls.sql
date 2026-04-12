-- RLS for public.contest_templates. Requires table + columns to exist.

alter table public.contest_templates enable row level security;

drop policy if exists "admin_full_access_templates" on public.contest_templates;
drop policy if exists "public_read_templates" on public.contest_templates;
drop policy if exists "admin_manage_templates" on public.contest_templates;

-- Anyone with table SELECT grant can read rows (lobby/catalog).
create policy "public_read_templates"
  on public.contest_templates
  for select
  using (true);

-- Staff only: insert / update / delete (SELECT is also covered by FOR ALL; public policy ORs for visibility).
create policy "admin_manage_templates"
  on public.contest_templates
  for all
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

grant select on table public.contest_templates to anon;
grant select on table public.contest_templates to authenticated;
grant insert, update, delete on table public.contest_templates to authenticated;

grant all on table public.contest_templates to service_role;
