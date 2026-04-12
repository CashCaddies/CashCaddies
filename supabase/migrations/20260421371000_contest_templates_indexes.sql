-- Requires `public.contest_templates` (is_active, sport).

create index if not exists idx_templates_active on public.contest_templates (is_active);
create index if not exists idx_templates_sport on public.contest_templates (sport);
