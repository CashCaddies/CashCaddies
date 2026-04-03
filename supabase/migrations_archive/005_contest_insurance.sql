-- Contest insurance settings + user claims. Run after 003_lineups_and_players (needs lineups, golfers).

create table if not exists public.contest_insurance (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  insurance_enabled boolean not null default false,
  insurance_cost numeric not null default 0,
  max_claims integer not null default 0,
  unique (contest_id)
);

create index if not exists contest_insurance_contest_id_idx on public.contest_insurance (contest_id);

create unique index if not exists contest_insurance_contest_id_key on public.contest_insurance (contest_id);

comment on table public.contest_insurance is 'Per-contest insurance product settings.';
comment on column public.contest_insurance.insurance_cost is 'Cost in the same currency unit as entry fees (e.g. dollars).';

create table if not exists public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  golfer_id uuid not null references public.golfers (id) on delete restrict,
  claim_type text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists insurance_claims_user_idx on public.insurance_claims (user_id);
create index if not exists insurance_claims_lineup_idx on public.insurance_claims (lineup_id);
create index if not exists insurance_claims_golfer_idx on public.insurance_claims (golfer_id);
create index if not exists insurance_claims_created_idx on public.insurance_claims (created_at desc);

comment on table public.insurance_claims is 'User-submitted insurance claims tied to a lineup and golfer (validate golfer is in lineup in app).';

alter table public.contest_insurance enable row level security;

drop policy if exists "Anyone can read contest insurance" on public.contest_insurance;
create policy "Anyone can read contest insurance"
  on public.contest_insurance
  for select
  to anon, authenticated
  using (true);

alter table public.insurance_claims enable row level security;

drop policy if exists "Users select own insurance claims" on public.insurance_claims;
create policy "Users select own insurance claims"
  on public.insurance_claims
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own insurance claims" on public.insurance_claims;
create policy "Users insert own insurance claims"
  on public.insurance_claims
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.lineups l
      where l.id = insurance_claims.lineup_id
        and l.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.lineup_players lp
      where lp.lineup_id = insurance_claims.lineup_id
        and lp.golfer_id = insurance_claims.golfer_id
    )
  );
