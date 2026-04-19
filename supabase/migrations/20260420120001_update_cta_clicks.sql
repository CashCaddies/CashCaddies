-- Tracks homepage update CTA ("Create Account / Request Beta Access") clicks per update.

create table if not exists public.update_cta_clicks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  update_id uuid references public.founder_updates (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  user_agent text
);

create index if not exists update_cta_clicks_update_id_idx on public.update_cta_clicks (update_id);
create index if not exists update_cta_clicks_created_at_idx on public.update_cta_clicks (created_at desc);

comment on table public.update_cta_clicks is 'Analytics: clicks on signup CTA embedded in CashCaddies Updates feed.';

alter table public.update_cta_clicks enable row level security;

create policy "authenticated users can insert update cta clicks"
  on public.update_cta_clicks
  for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

grant insert on table public.update_cta_clicks to authenticated;
