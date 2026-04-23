-- In-app beta waitlist requests (authenticated users who are not yet approved).
-- Accessed only via service role from API routes / server actions (no direct client grants).

create table if not exists public.waitlist_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  handle text,
  status text not null default 'pending'
    constraint waitlist_requests_status_check check (status in ('pending', 'approved', 'rejected')),
  message text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

comment on table public.waitlist_requests is
  'User-initiated closed-beta waitlist requests; reviewed by admins.';

create index if not exists waitlist_requests_user_id_idx on public.waitlist_requests (user_id);
create index if not exists waitlist_requests_status_idx on public.waitlist_requests (status);
create index if not exists waitlist_requests_requested_at_idx on public.waitlist_requests (requested_at desc);

create unique index if not exists waitlist_requests_one_pending_per_user_uidx
  on public.waitlist_requests (user_id)
  where status = 'pending';

alter table public.waitlist_requests enable row level security;

-- No policies: authenticated/anon cannot read or write; service_role bypasses RLS.

revoke all on public.waitlist_requests from public;
grant all on public.waitlist_requests to service_role;
