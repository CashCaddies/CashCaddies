-- Optional free-text reason / context for admin audit rows.

alter table public.admin_logs
  add column if not exists details text;

comment on column public.admin_logs.details is
  'Optional reason or extra context for the admin action.';
