-- Link a contest row back to the template it was spawned from (optional).

alter table public.contests
  add column if not exists template_id uuid references public.contest_templates (id) on delete set null;

comment on column public.contests.template_id is 'Optional FK to contest_templates when created from a template.';

create index if not exists contests_template_id_idx on public.contests (template_id)
  where template_id is not null;
