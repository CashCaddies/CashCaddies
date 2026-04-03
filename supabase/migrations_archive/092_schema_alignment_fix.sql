-- Schema alignment: additive columns, indexes, and admin RPC for environments missing later migrations.
-- Does not drop or rename columns. Safe to re-run.

-- ---------------------------------------------------------------------------
-- profiles: protection credit wallet (064+)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists protection_credit_balance numeric not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_protection_credit_balance_nonneg'
  ) then
    alter table public.profiles
      add constraint profiles_protection_credit_balance_nonneg check (protection_credit_balance >= 0);
  end if;
exception
  when others then null;
end
$$;

-- ---------------------------------------------------------------------------
-- contest_entries: automatic protection + safety tokens (083 / 085)
-- ---------------------------------------------------------------------------
alter table public.contest_entries
  add column if not exists protection_triggered boolean not null default false,
  add column if not exists protected_golfer_id uuid references public.golfers (id) on delete set null,
  add column if not exists protection_reason text,
  add column if not exists protection_token_issued boolean not null default false;

comment on column public.contest_entries.protection_triggered is
  'True after automatic CashCaddies protection applied (WD/DNS/DQ on a roster golfer).';

comment on column public.contest_entries.protected_golfer_id is
  'Golfer whose WD/DNS/DQ triggered automatic protection for this entry.';

comment on column public.contest_entries.protection_reason is
  'Trigger reason: WD, DNS, or DQ.';

comment on column public.contest_entries.protection_token_issued is
  'Pre–Round-1 WD/DNS/DQ: Safety Coverage Token issued instead of post-tee strip.';

-- ---------------------------------------------------------------------------
-- lineup_players: LIVE protection UI + swap window (064+)
-- ---------------------------------------------------------------------------
alter table public.lineup_players
  add column if not exists protection_ui_status text,
  add column if not exists swap_available_until timestamptz,
  add column if not exists protection_applied_at timestamptz;

comment on column public.lineup_players.protection_ui_status is
  'swap_available | protected | teed_off — LIVE tags in lineup UI.';

comment on column public.lineup_players.swap_available_until is
  'When set, swap window deadline for swap_available status.';

comment on column public.lineup_players.protection_applied_at is
  'When automatic protection credit was applied for this lineup player row.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lineup_players_protection_ui_status_check'
  ) then
    alter table public.lineup_players
      add constraint lineup_players_protection_ui_status_check check (
        protection_ui_status is null
        or protection_ui_status in ('swap_available', 'protected', 'teed_off')
      );
  end if;
exception
  when others then null;
end
$$;

-- ---------------------------------------------------------------------------
-- contest_insurance_runs: idempotent engine bookkeeping (052)
-- ---------------------------------------------------------------------------
create table if not exists public.contest_insurance_runs (
  contest_id text primary key,
  processed_at timestamptz not null default now(),
  total_credited_usd numeric not null default 0 check (total_credited_usd >= 0)
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'contest_insurance_runs'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contest_insurance_runs'
      and column_name = 'processed_at'
  ) then
    alter table public.contest_insurance_runs
      add column processed_at timestamptz not null default now();
  end if;
end
$$;

comment on table public.contest_insurance_runs is
  'One row per contest after automatic insurance payouts; prevents double processing.';

create index if not exists contest_insurance_runs_processed_at_idx
  on public.contest_insurance_runs (processed_at desc);

-- ---------------------------------------------------------------------------
-- Indexes used by lobby / safety stats
-- ---------------------------------------------------------------------------
create index if not exists contest_entries_protection_triggered_true_idx
  on public.contest_entries (contest_id)
  where protection_triggered = true;

-- ---------------------------------------------------------------------------
-- Admin beta feedback RPC: ensure (text) signature exists for PostgREST
-- ---------------------------------------------------------------------------
drop function if exists public.admin_user_list_beta_feedback();

drop function if exists public.admin_user_list_beta_feedback(text);

create or replace function public.admin_user_list_beta_feedback(p_filter text default 'all')
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  feedback_type text,
  title text,
  message text,
  issue_page text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f text := lower(trim(coalesce(p_filter, 'all')));
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    raise exception 'not an admin user' using errcode = '42501';
  end if;

  return query
  select
    bf.id,
    bf.user_id,
    p.username,
    p.email,
    bf.feedback_type,
    bf.title,
    bf.message,
    bf.issue_page,
    bf.status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  where case
    when f in ('', 'all') then true
    when f = 'new' then bf.status = 'new'
    else true
  end
  order by bf.created_at desc;
end;
$$;

grant execute on function public.admin_user_list_beta_feedback(text) to authenticated;
