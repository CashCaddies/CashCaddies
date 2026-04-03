-- DFS core: entry counts, capacity, wallet_balance alias, prize pool, payouts, indexes, duplicate lineup prevention.

-- ---------------------------------------------------------------------------
-- Wallet: explicit balance column (mirrors account_balance for APIs / clarity)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'wallet_balance'
  ) then
    alter table public.profiles
      add column wallet_balance numeric not null generated always as (account_balance) stored;
    comment on column public.profiles.wallet_balance is 'Same as account_balance; spendable wallet for contest entry.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Contest entry count (submitted entries, not draft lineups)
-- ---------------------------------------------------------------------------
drop function if exists public.contest_entry_count(text) cascade;
create or replace function public.contest_entry_count(p_contest_id text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.contest_entries ce
  where ce.contest_id::text = p_contest_id;
$$;

comment on function public.contest_entry_count(text) is 'Number of contest_entries rows for this contest (capacity).';

grant execute on function public.contest_entry_count(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lobby view: current_entries = paid/submitted entries; prize_pool = fees collected
-- ---------------------------------------------------------------------------
drop view if exists public.contests_with_stats cascade;
create view public.contests_with_stats as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.start_time,
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_entry_count(c.id::text)::integer as current_entries,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on view public.contests_with_stats is
  'Contests with entry count from contest_entries; prize_pool = entry_fee_usd * entries.';

grant select on public.contests_with_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payout structure (top X % of prize pool)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_payouts (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null,
  rank_place integer not null check (rank_place >= 1 and rank_place <= 100),
  payout_pct numeric not null check (payout_pct >= 0 and payout_pct <= 100),
  unique (contest_id, rank_place)
);

create index if not exists contest_payouts_contest_id_idx on public.contest_payouts (contest_id);

comment on table public.contest_payouts is 'Leaderboard prize share by finishing place (% of prize_pool).';

alter table public.contest_payouts enable row level security;

drop policy if exists "Anyone can read contest_payouts" on public.contest_payouts;
create policy "Anyone can read contest_payouts"
  on public.contest_payouts
  for select
  to anon, authenticated
  using (true);

grant select on public.contest_payouts to anon, authenticated;

insert into public.contest_payouts (contest_id, rank_place, payout_pct)
select c.id, r.place, r.pct
from public.contests c
cross join (values (1, 50::numeric), (2, 30::numeric), (3, 20::numeric)) as r(place, pct)
on conflict (contest_id, rank_place) do nothing;

-- ---------------------------------------------------------------------------
-- Duplicate lineup: one entry row per (contest, lineup) when lineup is set
-- ---------------------------------------------------------------------------
create unique index if not exists contest_entries_contest_lineup_unique
  on public.contest_entries (contest_id, lineup_id)
  where lineup_id is not null;

-- ---------------------------------------------------------------------------
-- FK: contest_entries -> contests
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contest_entries_contest_id_fkey'
  ) then
    alter table public.contest_entries
      add constraint contest_entries_contest_id_fkey
      foreign key (contest_id) references public.contests (id) on delete cascade;
  end if;
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- Entry capacity & per-user limits (before insert)
-- ---------------------------------------------------------------------------
drop function if exists public.trg_enforce_contest_entry_capacity() cascade;
create or replace function public.trg_enforce_contest_entry_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer;
  per_user integer;
  n_total bigint;
  n_user bigint;
begin
  select c.max_entries, c.max_entries_per_user
  into cap, per_user
  from public.contests c
  where c.id::text = new.contest_id::text;

  if not found then
    raise exception 'Contest not found.';
  end if;

  n_total := public.contest_entry_count(new.contest_id::text);
  if tg_op = 'INSERT' then
    if n_total >= cap then
      raise exception 'Contest is full.';
    end if;
    n_user := (
      select count(*)::bigint from public.contest_entries ce
      where ce.contest_id::text = new.contest_id::text and ce.user_id = new.user_id
    );
    if n_user >= coalesce(per_user, 999999) then
      raise exception 'Max entries per user for this contest.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_contest_entry_capacity on public.contest_entries;
create trigger enforce_contest_entry_capacity
before insert on public.contest_entries
for each row execute function public.trg_enforce_contest_entry_capacity();

-- ---------------------------------------------------------------------------
-- Performance: leaderboard-oriented indexes
-- ---------------------------------------------------------------------------
create index if not exists contest_entries_contest_user_idx
  on public.contest_entries (contest_id, user_id);

create index if not exists lineups_contest_score_idx
  on public.lineups (contest_id, total_score desc nulls last)
  where contest_entry_id is not null;
