-- Conversion events from homepage update CTAs (e.g. signup attributed to founder_updates).

create table public.update_conversions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  update_id uuid not null references public.founder_updates (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null
);

create index update_conversions_update_id_idx on public.update_conversions (update_id);
create index update_conversions_user_id_idx on public.update_conversions (user_id);

comment on table public.update_conversions is 'Attributed conversions from update CTAs (type e.g. signup).';
comment on column public.update_conversions.type is 'Conversion kind: signup, etc.';

alter table public.update_conversions enable row level security;

create policy "authenticated users can insert own update conversions"
  on public.update_conversions
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

grant insert on table public.update_conversions to authenticated;
