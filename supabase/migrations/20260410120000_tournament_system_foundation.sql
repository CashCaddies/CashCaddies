-- Tournament system foundation: PGA-style events, rounds, and course catalog.
-- Does not alter existing tables.

-- ---------------------------------------------------------------------------
-- courses (venue catalog; optional FK from tournaments later)
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text,
  par integer,
  yardage integer,
  location text
);

comment on table public.courses is 'Golf course catalog (par, yardage, location).';

alter table public.courses enable row level security;

create policy "courses_select_all"
  on public.courses
  for select
  to anon, authenticated
  using (true);

grant select on table public.courses to anon;
grant select on table public.courses to authenticated;
grant all on table public.courses to service_role;

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tour text,
  course_name text,
  course_location text,
  start_date date,
  end_date date,
  status text not null default 'scheduled',
  current_round integer not null default 0,
  total_rounds integer not null default 4,
  created_at timestamptz not null default now()
);

comment on table public.tournaments is 'Real-world golf tournament (PGA event) metadata for DFS alignment.';

create index if not exists tournaments_status_idx on public.tournaments (status);
create index if not exists tournaments_start_date_idx on public.tournaments (start_date);

alter table public.tournaments enable row level security;

create policy "tournaments_select_all"
  on public.tournaments
  for select
  to anon, authenticated
  using (true);

grant select on table public.tournaments to anon;
grant select on table public.tournaments to authenticated;
grant all on table public.tournaments to service_role;

-- ---------------------------------------------------------------------------
-- tournament_rounds
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round_number integer not null,
  status text not null default 'pending',
  start_time timestamptz,
  end_time timestamptz
);

comment on table public.tournament_rounds is 'Per-round schedule and status for a tournament.';

create index if not exists tournament_rounds_tournament_id_idx on public.tournament_rounds (tournament_id);

create unique index if not exists tournament_rounds_tournament_round_uidx
  on public.tournament_rounds (tournament_id, round_number);

alter table public.tournament_rounds enable row level security;

create policy "tournament_rounds_select_all"
  on public.tournament_rounds
  for select
  to anon, authenticated
  using (true);

grant select on table public.tournament_rounds to anon;
grant select on table public.tournament_rounds to authenticated;
grant all on table public.tournament_rounds to service_role;
