alter table public.contests
  add column if not exists is_portal boolean not null default false,
  add column if not exists portal_frequency text,
  add column if not exists overlay_amount numeric not null default 0,
  add column if not exists is_featured boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contests_portal_frequency_check'
      and conrelid = 'public.contests'::regclass
  ) then
    alter table public.contests
      add constraint contests_portal_frequency_check
      check (portal_frequency in ('weekly', 'biweekly', 'monthly') or portal_frequency is null);
  end if;
end $$;

comment on column public.contests.is_portal is 'True when the contest is restricted to portal audiences.';
comment on column public.contests.portal_frequency is 'Portal cadence: weekly, biweekly, or monthly.';
comment on column public.contests.overlay_amount is 'Added money (overlay) applied to the contest.';
comment on column public.contests.is_featured is 'Marks contests that should be highlighted in featured placements.';
