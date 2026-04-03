-- Segregated CashCaddies Player Protection fund: operational money and insurance pool are structurally separated.
-- Pool balance moves only via insurance_transactions (funding from contest rake, payouts from pool). No profiles / wallet columns here.

-- ---------------------------------------------------------------------------
-- insurance_pool: singleton ledger balance (not user wallets)
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_pool (
  id uuid primary key default gen_random_uuid(),
  total_balance numeric not null default 0
    constraint insurance_pool_total_balance_nonneg check (total_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.insurance_pool is
  'Singleton row: segregated insurance fund for player protection. Not mixed with operational accounts; balance changes only via insurance_transactions + triggers.';

comment on column public.insurance_pool.total_balance is
  'Running balance of the segregated player-protection pool; must stay non-negative.';

insert into public.insurance_pool (total_balance)
select 0
where not exists (select 1 from public.insurance_pool limit 1);

create or replace function public.trg_insurance_pool_single_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*)::int from public.insurance_pool) >= 1 then
    raise exception 'insurance_pool allows only one row; this fund is segregated for player protection.';
  end if;
  return new;
end;
$$;

drop trigger if exists insurance_pool_single_row on public.insurance_pool;
create trigger insurance_pool_single_row
before insert on public.insurance_pool
for each row execute function public.trg_insurance_pool_single_row();

-- ---------------------------------------------------------------------------
-- insurance_transactions: append-only ledger (funding / payouts)
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  type text not null
    constraint insurance_transactions_type_check
      check (type in ('insurance_funding', 'insurance_payout')),
  contest_id text not null references public.contests (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  constraint insurance_transactions_amount_sign_by_type check (
    (type = 'insurance_funding' and amount > 0)
    or (type = 'insurance_payout' and amount < 0)
  )
);

comment on table public.insurance_transactions is
  'Segregated player-protection ledger: insurance_funding increases the pool (contest rake allocation only); insurance_payout decreases the pool. Does not post to profiles or operational wallets.';

comment on column public.insurance_transactions.amount is
  'Signed: positive insurance_funding (rake to pool), negative insurance_payout (from pool).';

comment on column public.insurance_transactions.type is
  'insurance_funding: only allowed source of pool increases (contest rake allocation). insurance_payout: only allowed pool decreases.';

create index if not exists insurance_transactions_contest_id_idx
  on public.insurance_transactions (contest_id);

create index if not exists insurance_transactions_user_id_idx
  on public.insurance_transactions (user_id);

create index if not exists insurance_transactions_created_at_idx
  on public.insurance_transactions (created_at desc);

-- ---------------------------------------------------------------------------
-- insurance_events: coverage events (WD / DQ / DNS) with recorded payout amount
-- ---------------------------------------------------------------------------
create table if not exists public.insurance_events (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null references public.contests (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  lineup_id uuid references public.lineups (id) on delete set null,
  event_type text not null
    constraint insurance_events_event_type_check
      check (event_type in ('withdrawal', 'dq', 'dns')),
  insurance_payout_amount numeric not null
    constraint insurance_events_payout_amount_nonneg check (insurance_payout_amount >= 0),
  created_at timestamptz not null default now()
);

comment on table public.insurance_events is
  'Player-protection events (withdrawal, dq, dns) and the insurance-side payout amount; operational wallet handling stays outside this table.';

create index if not exists insurance_events_contest_id_idx
  on public.insurance_events (contest_id);

create index if not exists insurance_events_user_id_idx
  on public.insurance_events (user_id);

create index if not exists insurance_events_lineup_id_idx
  on public.insurance_events (lineup_id);

-- ---------------------------------------------------------------------------
-- Validation: funding must be rake-scoped (contest); payouts require beneficiary user
-- ---------------------------------------------------------------------------
create or replace function public.trg_insurance_transactions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'insurance_funding' then
    if new.contest_id is null then
      raise exception 'insurance_funding requires contest_id (contest rake allocation).';
    end if;
    if new.amount <= 0 then
      raise exception 'insurance_funding amount must be positive.';
    end if;
  elsif new.type = 'insurance_payout' then
    if new.amount >= 0 then
      raise exception 'insurance_payout amount must be negative (pool debit).';
    end if;
    if new.user_id is null then
      raise exception 'insurance_payout requires user_id for the protected payout beneficiary.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists insurance_transactions_validate on public.insurance_transactions;
create trigger insurance_transactions_validate
before insert on public.insurance_transactions
for each row execute function public.trg_insurance_transactions_validate();

-- ---------------------------------------------------------------------------
-- Apply transaction to singleton pool; prevents negative balance
-- ---------------------------------------------------------------------------
create or replace function public.trg_insurance_transactions_apply_pool()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid;
  v_new_bal numeric;
begin
  select p.id into v_pool_id from public.insurance_pool p limit 1;
  if v_pool_id is null then
    raise exception 'insurance_pool bootstrap row missing.';
  end if;

  perform set_config('app.allow_insurance_pool_balance', '1', true);

  update public.insurance_pool p
  set
    total_balance = round(p.total_balance + new.amount, 2),
    updated_at = now()
  where p.id = v_pool_id
  returning p.total_balance into v_new_bal;

  perform set_config('app.allow_insurance_pool_balance', '', true);

  if v_new_bal < 0 then
    raise exception 'insurance pool balance cannot be negative; payout exceeds segregated pool.';
  end if;

  return new;
end;
$$;

drop trigger if exists insurance_transactions_apply_pool on public.insurance_transactions;
create trigger insurance_transactions_apply_pool
after insert on public.insurance_transactions
for each row execute function public.trg_insurance_transactions_apply_pool();

-- ---------------------------------------------------------------------------
-- Block direct balance edits on insurance_pool (only trg_insurance_transactions_apply_pool sets allow flag)
-- ---------------------------------------------------------------------------
create or replace function public.trg_insurance_pool_guard_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_balance is distinct from old.total_balance
     and coalesce(current_setting('app.allow_insurance_pool_balance', true), '') <> '1'
  then
    raise exception 'insurance_pool.total_balance is ledger-controlled via insurance_transactions only; no direct wallet interaction.';
  end if;
  return new;
end;
$$;

drop trigger if exists insurance_pool_guard_balance on public.insurance_pool;
create trigger insurance_pool_guard_balance
before update on public.insurance_pool
for each row execute function public.trg_insurance_pool_guard_balance();

-- ---------------------------------------------------------------------------
-- RLS: read-only pool for clients; writes reserved for service (rake / payout jobs)
-- ---------------------------------------------------------------------------
alter table public.insurance_pool enable row level security;
alter table public.insurance_transactions enable row level security;
alter table public.insurance_events enable row level security;

drop policy if exists "Anyone can read insurance pool" on public.insurance_pool;
create policy "Anyone can read insurance pool"
  on public.insurance_pool
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Users read own insurance transactions" on public.insurance_transactions;
create policy "Users read own insurance transactions"
  on public.insurance_transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users read own insurance events" on public.insurance_events;
create policy "Users read own insurance events"
  on public.insurance_events
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.insurance_pool to anon, authenticated;
grant select on public.insurance_transactions to authenticated;
grant select on public.insurance_events to authenticated;

-- Writes: backend jobs using service_role only (immutable ledger; pool moves via inserts + apply trigger).
grant insert on public.insurance_transactions to service_role;
grant insert on public.insurance_events to service_role;
grant insert on public.insurance_pool to service_role;
