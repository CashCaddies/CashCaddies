-- 090_apply_missing_migrations.sql
-- Combined migrations 060-087 (filename order). Run once in SQL Editor if CLI cannot apply them.
-- After success: npm run db:repair-catchup on a linked machine.

-- SAFETY (public.transactions.type): Existing rows may use legacy values not listed in
-- migrations 060–080 CHECK constraints, which causes ADD CONSTRAINT to fail. This block
-- drops the old CHECK, normalizes data (no DELETE), then SOURCE 060 applies the final
-- 080-era type list once. Intermediate migrations 064/065/078/080 skip re-adding the CHECK.
-- Diagnostic (run in SQL Editor if needed): SELECT DISTINCT type FROM public.transactions ORDER BY 1;

alter table public.transactions
  drop constraint if exists transactions_type_check;

update public.transactions
set type = lower(trim(type));

update public.transactions
set type = 'credit'
where type is null or type = '';

update public.transactions
set type = 'contest_entry'
where type = 'contest entry';

update public.transactions
set type = 'credit'
where type not in (
  'entry',
  'contest_entry',
  'credit',
  'refund',
  'protection_purchase',
  'safety_coverage_fee',
  'platform_fee',
  'contest_prize',
  'contest_insurance_payout',
  'test_credit',
  'protection_credit',
  'protection_credit_spend',
  'beta_credit'
);

-- SAFETY (public.contests.id vs public.*.contest_id): If contests.id is uuid but child
-- contest_id columns are still text, ADD CONSTRAINT / CREATE TABLE ... REFERENCES fails.
-- Drops FKs toward public.contests(id), drops lobby view, converts via temp contest_id_uuid
-- column + UPDATEs (no subqueries in ALTER ... USING), then DROP old column + RENAME.
-- Unmapped values become NULL where needed; no DELETE. Re-adds contest_entries FK when safe.
-- Run if needed: SELECT table_name, data_type FROM information_schema.columns WHERE column_name = 'contest_id' AND table_schema = 'public';

drop view if exists public.contests_with_stats cascade;

do $drop_fk$
declare
  r record;
begin
  for r in
    select c.conname, n.nspname as sch, rel.relname as tbl
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where c.contype = 'f'
      and c.confrelid = 'public.contests'::regclass
      and n.nspname = 'public'
  loop
    execute format(
      'alter table %I.%I drop constraint if exists %I',
      r.sch,
      r.tbl,
      r.conname
    );
  end loop;
end
$drop_fk$;

do $contests_id$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contests'
      and column_name = 'id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.contests
      alter column id type uuid using trim(id::text)::uuid;
  end if;
end
$contests_id$;

-- Child contest_id: multi-step (Postgres forbids subqueries inside ALTER ... USING).
-- Pattern: add contest_id_uuid, UPDATE (regex + join to contests), drop text column CASCADE, rename.
-- Idempotent: skip if contest_id is already uuid. No DELETE.

do $contest_id_to_uuid$
declare
  r record;
  _sql text;
begin
  -- contest_entries (typical FK + partial unique index)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contest_entries'
      and column_name = 'contest_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.contest_entries add column if not exists contest_id_uuid uuid;

    update public.contest_entries
    set contest_id_uuid = trim(contest_id)::uuid
    where contest_id is not null
      and contest_id ~* '^[0-9a-f-]{36}$'
      and contest_id_uuid is null;

    update public.contest_entries ce
    set contest_id_uuid = c.id
    from public.contests c
    where ce.contest_id_uuid is null
      and ce.contest_id is not null
      and trim(ce.contest_id) = trim(c.id::text);

    update public.contest_entries
    set contest_id_uuid = null
    where contest_id_uuid is null
      and contest_id is not null;

    alter table public.contest_entries
      drop column if exists contest_id cascade;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contest_entries'
        and column_name = 'contest_id_uuid'
    ) then
      alter table public.contest_entries rename column contest_id_uuid to contest_id;
    end if;

    create index if not exists contest_entries_contest_idx on public.contest_entries (contest_id);

    create unique index if not exists contest_entries_contest_lineup_unique
      on public.contest_entries (contest_id, lineup_id)
      where lineup_id is not null;

    if not exists (select 1 from public.contest_entries where contest_id is null) then
      alter table public.contest_entries alter column contest_id set not null;
    end if;
  end if;

  -- lineups (nullable contest_id)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lineups'
      and column_name = 'contest_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.lineups add column if not exists contest_id_uuid uuid;

    update public.lineups
    set contest_id_uuid = trim(contest_id)::uuid
    where contest_id is not null
      and contest_id ~* '^[0-9a-f-]{36}$'
      and contest_id_uuid is null;

    update public.lineups l
    set contest_id_uuid = c.id
    from public.contests c
    where l.contest_id_uuid is null
      and l.contest_id is not null
      and trim(l.contest_id) = trim(c.id::text);

    update public.lineups
    set contest_id_uuid = null
    where contest_id_uuid is null
      and contest_id is not null;

    alter table public.lineups
      drop column if exists contest_id cascade;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lineups'
        and column_name = 'contest_id_uuid'
    ) then
      alter table public.lineups rename column contest_id_uuid to contest_id;
    end if;

    create index if not exists lineups_contest_idx on public.lineups (contest_id);

    create index if not exists lineups_contest_score_idx
      on public.lineups (contest_id, total_score desc nulls last);
  end if;

  -- contest_payouts (unique on contest_id + rank_place)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contest_payouts'
      and column_name = 'contest_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.contest_payouts add column if not exists contest_id_uuid uuid;

    update public.contest_payouts
    set contest_id_uuid = trim(contest_id)::uuid
    where contest_id is not null
      and contest_id ~* '^[0-9a-f-]{36}$'
      and contest_id_uuid is null;

    update public.contest_payouts cp
    set contest_id_uuid = c.id
    from public.contests c
    where cp.contest_id_uuid is null
      and cp.contest_id is not null
      and trim(cp.contest_id) = trim(c.id::text);

    update public.contest_payouts
    set contest_id_uuid = null
    where contest_id_uuid is null
      and contest_id is not null;

    alter table public.contest_payouts
      drop column if exists contest_id cascade;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contest_payouts'
        and column_name = 'contest_id_uuid'
    ) then
      alter table public.contest_payouts rename column contest_id_uuid to contest_id;
    end if;

    create index if not exists contest_payouts_contest_id_idx on public.contest_payouts (contest_id);

    if not exists (select 1 from public.contest_payouts where contest_id is null) then
      alter table public.contest_payouts alter column contest_id set not null;
    end if;

    begin
      alter table public.contest_payouts
        drop constraint if exists contest_payouts_contest_id_rank_place_key;
      alter table public.contest_payouts
        add constraint contest_payouts_contest_id_rank_place_key unique (contest_id, rank_place);
    exception
      when duplicate_object then null;
    end;
  end if;

  -- golfer_scores (composite PK on golfer_id, contest_id)
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'golfer_scores'
      and column_name = 'contest_id'
      and data_type in ('text', 'character varying')
  ) then
    alter table public.golfer_scores add column if not exists contest_id_uuid uuid;

    update public.golfer_scores
    set contest_id_uuid = trim(contest_id)::uuid
    where contest_id is not null
      and contest_id ~* '^[0-9a-f-]{36}$'
      and contest_id_uuid is null;

    update public.golfer_scores gs
    set contest_id_uuid = c.id
    from public.contests c
    where gs.contest_id_uuid is null
      and gs.contest_id is not null
      and trim(gs.contest_id) = trim(c.id::text);

    update public.golfer_scores
    set contest_id_uuid = null
    where contest_id_uuid is null
      and contest_id is not null;

    alter table public.golfer_scores
      drop column if exists contest_id cascade;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'golfer_scores'
        and column_name = 'contest_id_uuid'
    ) then
      alter table public.golfer_scores rename column contest_id_uuid to contest_id;
    end if;

    create index if not exists golfer_scores_contest_id_idx on public.golfer_scores (contest_id);

    if not exists (select 1 from public.golfer_scores where contest_id is null) then
      alter table public.golfer_scores alter column contest_id set not null;
      begin
        alter table public.golfer_scores drop constraint if exists golfer_scores_pkey;
        alter table public.golfer_scores
          add constraint golfer_scores_pkey primary key (golfer_id, contest_id);
      exception
        when duplicate_object then null;
      end;
    end if;
  end if;

  -- Any other public tables with text contest_id (e.g. later migrations partially applied)
  for r in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'contest_id'
      and c.data_type in ('text', 'character varying')
      and c.table_name not in ('contest_entries', 'lineups', 'contest_payouts', 'golfer_scores')
  loop
    _sql := format(
      'alter table public.%I add column if not exists contest_id_uuid uuid',
      r.table_name
    );
    execute _sql;

    _sql := format(
      $u$
      update public.%I
      set contest_id_uuid = trim(contest_id)::uuid
      where contest_id is not null
        and contest_id ~* '^[0-9a-f-]{36}$'
        and contest_id_uuid is null
      $u$,
      r.table_name
    );
    execute _sql;

    _sql := format(
      $u$
      update public.%I t
      set contest_id_uuid = c.id
      from public.contests c
      where t.contest_id_uuid is null
        and t.contest_id is not null
        and trim(t.contest_id) = trim(c.id::text)
      $u$,
      r.table_name
    );
    execute _sql;

    _sql := format(
      $u$
      update public.%I
      set contest_id_uuid = null
      where contest_id_uuid is null
        and contest_id is not null
      $u$,
      r.table_name
    );
    execute _sql;

    _sql := format(
      'alter table public.%I drop column if exists contest_id cascade',
      r.table_name
    );
    execute _sql;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = r.table_name
        and column_name = 'contest_id_uuid'
    ) then
      _sql := format(
        'alter table public.%I rename column contest_id_uuid to contest_id',
        r.table_name
      );
      execute _sql;
    end if;
  end loop;

  -- Restore FK dropped above (038-era); safe if already present
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contest_entries')
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'contest_entries'
         and column_name = 'contest_id'
         and udt_name = 'uuid'
     )
  then
    begin
      alter table public.contest_entries
        add constraint contest_entries_contest_id_fkey
        foreign key (contest_id) references public.contests (id) on delete cascade;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$contest_id_to_uuid$;

-- SOURCE: 060_contest_entry_atomic_wallet_order_and_type.sql (order 60)
-- ============================================================================

-- contest_entry transaction type; create_contest_entry_atomic: deduct wallet before contest_entries row; auth check for user calls.

alter table public.transactions
  drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check check (
    type in (
      'entry',
      'contest_entry',
      'credit',
      'refund',
      'protection_purchase',
      'safety_coverage_fee',
      'platform_fee',
      'contest_prize',
      'contest_insurance_payout',
      'test_credit',
      'protection_credit',
      'protection_credit_spend',
      'beta_credit'
    )
  );

comment on constraint transactions_type_check on public.transactions is
  'Includes safety_coverage_fee/platform_fee labels and beta_credit wallet funding.';

drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text) cascade;

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock bigint;
  v_next int;
  v_has_prof boolean;
  v_total numeric;
  v_ce_id uuid;
  prof record;
  v_balance numeric;
  v_credits numeric;
  v_loy int;
  v_earn int;
  v_new_loy int;
  v_new_bal numeric;
  v_tier text;
  v_ef numeric;
  v_pf numeric;
  v_cid uuid;
  v_name text;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  v_cid := trim(p_contest_id)::uuid;
  v_name := coalesce(nullif(trim(p_contest_name), ''), 'Contest');

  v_ef := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  v_pf := round(greatest(coalesce(p_protection_fee, 0), 0)::numeric, 2);
  v_total := round(v_ef + v_pf, 2);

  if coalesce(p_total_paid, 0) <= 0 then
    v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
    perform pg_advisory_xact_lock(v_lock);

    select coalesce(max(ce.entry_number), 0) + 1
      into v_next
      from public.contest_entries ce
      where ce.user_id = p_user_id
        and ce.contest_id = v_cid;

    insert into public.contest_entries (
      user_id,
      contest_id,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_id,
      entry_number
    )
    values (
      p_user_id,
      v_cid,
      v_ef,
      v_pf,
      0,
      coalesce(p_protection_enabled, false),
      p_lineup_id,
      v_next
    )
    returning id into v_ce_id;

    return jsonb_build_object(
      'ok', true,
      'contest_entry_id', v_ce_id,
      'credits_restored', 0,
      'balance_restored', 0,
      'loyalty_points_earned', 0
    );
  end if;

  v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
  perform pg_advisory_xact_lock(v_lock);

  select coalesce(max(ce.entry_number), 0) + 1
    into v_next
    from public.contest_entries ce
    where ce.user_id = p_user_id
      and ce.contest_id = v_cid;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    p.id,
    round(coalesce(p.account_balance, 0)::numeric, 2) as account_balance,
    round(coalesce(p.site_credits, 0)::numeric, 2) as site_credits,
    greatest(0, floor(coalesce(p.loyalty_points, 0))::int) as loyalty_points
  into prof
  from public.profiles p
  where p.id = p_user_id
  for update;

  v_has_prof := found;
  if not v_has_prof then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  v_balance := prof.account_balance;
  v_credits := prof.site_credits;
  v_loy := prof.loyalty_points;

  if v_ef > 0 and v_balance < v_ef then
    raise exception using
      message = format(
        'Insufficient account balance for contest entry fee. Need $%s (account balance is $%s).',
        v_ef::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  if v_balance < v_total then
    raise exception using
      message = format(
        'Insufficient account balance. Need $%s (entry fee + protection, account balance is $%s).',
        v_total::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  v_new_bal := round(v_balance - v_total, 2);
  if v_new_bal < 0 then
    raise exception using
      message = 'Contest entry would result in a negative account balance.',
      errcode = 'P0001';
  end if;

  v_earn := floor(v_ef * 10)::int;
  v_new_loy := v_loy + v_earn;
  v_tier := public.loyalty_tier_from_points(v_new_loy);

  update public.profiles p
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where p.id = p_user_id;

  insert into public.contest_entries (
    user_id,
    contest_id,
    entry_fee,
    protection_fee,
    total_paid,
    protection_enabled,
    lineup_id,
    entry_number
  )
  values (
    p_user_id,
    v_cid,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next
  )
  returning id into v_ce_id;

  if v_ef > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_ef,
      'contest_entry',
      v_name
    );
  end if;

  if v_pf > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_pf,
      'protection_purchase',
      format('CashCaddie Protection — %s', v_name)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'contest_entry_id', v_ce_id,
    'credits_restored', 0,
    'balance_restored', v_total,
    'loyalty_points_earned', v_earn
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate contest entry (same user, contest, and entry slot).');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'Invalid contest id (expected UUID).');
  when others then
    raise;
end;
$$;


-- ============================================================================
-- SOURCE: 061_max_entries_per_user_trigger_and_rpc.sql (order 61)
-- ============================================================================

-- Restore capacity trigger (049 CASCADE dropped it). Enforce max_entries / max_entries_per_user on INSERT.
-- create_contest_entry_atomic: validate eligibility (timing + capacity) before wallet debit.

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
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select c.max_entries, c.max_entries_per_user
  into cap, per_user
  from public.contests c
  where c.id::text = new.contest_id::text
  for update;

  if not found then
    raise exception 'Contest not found.'
      using errcode = 'P0001';
  end if;

  cap := greatest(1, coalesce(cap, 1));

  select count(*)::bigint
  into n_total
  from public.contest_entries ce
  where ce.contest_id::text = new.contest_id::text;

  if n_total >= cap then
    raise exception 'This contest is full.'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint
  into n_user
  from public.contest_entries ce
  where ce.contest_id::text = new.contest_id::text
    and ce.user_id = new.user_id;

  if n_user >= coalesce(per_user, 999999) then
    raise exception 'Maximum entries reached for this contest.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_contest_entry_capacity on public.contest_entries;
create trigger enforce_contest_entry_capacity
before insert on public.contest_entries
for each row execute function public.trg_enforce_contest_entry_capacity();

comment on function public.trg_enforce_contest_entry_capacity() is
  'Before insert: lock contest row, reject at max_entries or max_entries_per_user (same transaction as insert).';

drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text) cascade;

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock bigint;
  v_next int;
  v_has_prof boolean;
  v_total numeric;
  v_ce_id uuid;
  prof record;
  v_balance numeric;
  v_credits numeric;
  v_loy int;
  v_earn int;
  v_new_loy int;
  v_new_bal numeric;
  v_tier text;
  v_ef numeric;
  v_pf numeric;
  v_cid uuid;
  v_name text;
  v_cap int;
  v_per_user int;
  n_total bigint;
  n_user bigint;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  v_cid := trim(p_contest_id)::uuid;
  v_name := coalesce(nullif(trim(p_contest_name), ''), 'Contest');

  v_ef := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  v_pf := round(greatest(coalesce(p_protection_fee, 0), 0)::numeric, 2);
  v_total := round(v_ef + v_pf, 2);

  v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
  perform pg_advisory_xact_lock(v_lock);

  if public.contest_is_past_start(v_cid::text) then
    raise exception 'Contest has started; entries are closed.'
      using errcode = 'P0001';
  end if;

  select c.max_entries, c.max_entries_per_user
  into v_cap, v_per_user
  from public.contests c
  where c.id = v_cid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  v_cap := greatest(1, coalesce(v_cap, 1));

  select count(*)::bigint
  into n_total
  from public.contest_entries ce
  where ce.contest_id = v_cid;

  if n_total >= v_cap then
    raise exception 'This contest is full.'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint
  into n_user
  from public.contest_entries ce
  where ce.contest_id = v_cid
    and ce.user_id = p_user_id;

  if n_user >= coalesce(v_per_user, 999999) then
    raise exception 'Maximum entries reached for this contest.'
      using errcode = 'P0001';
  end if;

  select coalesce(max(ce.entry_number), 0) + 1
    into v_next
    from public.contest_entries ce
    where ce.user_id = p_user_id
      and ce.contest_id = v_cid;

  if coalesce(p_total_paid, 0) <= 0 then
    insert into public.contest_entries (
      user_id,
      contest_id,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_id,
      entry_number
    )
    values (
      p_user_id,
      v_cid,
      v_ef,
      v_pf,
      0,
      coalesce(p_protection_enabled, false),
      p_lineup_id,
      v_next
    )
    returning id into v_ce_id;

    return jsonb_build_object(
      'ok', true,
      'contest_entry_id', v_ce_id,
      'credits_restored', 0,
      'balance_restored', 0,
      'loyalty_points_earned', 0
    );
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    p.id,
    round(coalesce(p.account_balance, 0)::numeric, 2) as account_balance,
    round(coalesce(p.site_credits, 0)::numeric, 2) as site_credits,
    greatest(0, floor(coalesce(p.loyalty_points, 0))::int) as loyalty_points
  into prof
  from public.profiles p
  where p.id = p_user_id
  for update;

  v_has_prof := found;
  if not v_has_prof then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  v_balance := prof.account_balance;
  v_credits := prof.site_credits;
  v_loy := prof.loyalty_points;

  if v_ef > 0 and v_balance < v_ef then
    raise exception using
      message = format(
        'Insufficient account balance for contest entry fee. Need $%s (account balance is $%s).',
        v_ef::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  if v_balance < v_total then
    raise exception using
      message = format(
        'Insufficient account balance. Need $%s (entry fee + protection, account balance is $%s).',
        v_total::text,
        v_balance::text
      ),
      errcode = 'P0001';
  end if;

  v_new_bal := round(v_balance - v_total, 2);
  if v_new_bal < 0 then
    raise exception using
      message = 'Contest entry would result in a negative account balance.',
      errcode = 'P0001';
  end if;

  v_earn := floor(v_ef * 10)::int;
  v_new_loy := v_loy + v_earn;
  v_tier := public.loyalty_tier_from_points(v_new_loy);

  update public.profiles p
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where p.id = p_user_id;

  insert into public.contest_entries (
    user_id,
    contest_id,
    entry_fee,
    protection_fee,
    total_paid,
    protection_enabled,
    lineup_id,
    entry_number
  )
  values (
    p_user_id,
    v_cid,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next
  )
  returning id into v_ce_id;

  if v_ef > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_ef,
      'contest_entry',
      v_name
    );
  end if;

  if v_pf > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_pf,
      'protection_purchase',
      format('CashCaddie Protection — %s', v_name)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'contest_entry_id', v_ce_id,
    'credits_restored', 0,
    'balance_restored', v_total,
    'loyalty_points_earned', v_earn
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate contest entry (same user, contest, and entry slot).');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'Invalid contest id (expected UUID).');
  when others then
    raise;
end;
$$;


-- ============================================================================
-- SOURCE: 062_insurance_pool_segregated_fund.sql (order 62)
-- ============================================================================

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

drop function if exists public.trg_insurance_pool_single_row() cascade;

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
  contest_id uuid not null references public.contests (id) on delete restrict,
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
  contest_id uuid not null references public.contests (id) on delete restrict,
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
drop function if exists public.trg_insurance_transactions_validate() cascade;

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
drop function if exists public.trg_insurance_transactions_apply_pool() cascade;

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
drop function if exists public.trg_insurance_pool_guard_balance() cascade;

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


-- ============================================================================
-- SOURCE: 063_insurance_pool_realtime.sql (order 63)
-- ============================================================================

-- Broadcast insurance_pool row updates so the Community Protection Fund banner can subscribe (read-only UI).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.insurance_pool';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;


-- ============================================================================
-- SOURCE: 064_protection_engine_v1.sql (order 64)
-- ============================================================================

-- CashCaddies Protection Engine v1: protection credit, pool payouts, swap state, notifications, scoring overlay.

-- ---------------------------------------------------------------------------
-- profiles: non-withdrawable protection credit (used before cash on entry)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists protection_credit_balance numeric not null default 0
    constraint profiles_protection_credit_balance_nonneg check (protection_credit_balance >= 0);

comment on column public.profiles.protection_credit_balance is
  'Community Protection Credit from WD/DNS/DQ events; spendable on contest entry only before cash; not withdrawable; does not expire.';

-- ---------------------------------------------------------------------------
-- transactions: protection_credit (positive) when protection applies
-- (transactions_type_check already applied with final 080 type union in SOURCE 060.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- protection_events: audit trail (per user request; separate from insurance_events)
-- ---------------------------------------------------------------------------
create table if not exists public.protection_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id uuid not null references public.contests (id) on delete restrict,
  lineup_id uuid not null references public.lineups (id) on delete cascade,
  golfer_id uuid not null references public.golfers (id) on delete restrict,
  event_type text not null
    constraint protection_events_event_type_check
      check (event_type in ('wd', 'dns', 'dq')),
  protection_amount numeric not null check (protection_amount >= 0),
  contest_entry_id uuid references public.contest_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint protection_events_lineup_golfer_contest unique (lineup_id, golfer_id, contest_id)
);

create index if not exists protection_events_user_created_idx
  on public.protection_events (user_id, created_at desc);

comment on table public.protection_events is
  'Player protection payouts: WD/DNS/DQ; pairs with protection_credit transaction and insurance_transactions pool debit.';

-- ---------------------------------------------------------------------------
-- user_notifications: in-app banner + history
-- ---------------------------------------------------------------------------
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'protection',
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

comment on table public.user_notifications is
  'In-app notifications; protection kind used for Community Protection Fund messages.';

-- ---------------------------------------------------------------------------
-- golfer_scores: per-contest playing status for WD/DNS/DQ and tee time
-- ---------------------------------------------------------------------------
alter table public.golfer_scores
  add column if not exists playing_status text not null default 'not_started'
    constraint golfer_scores_playing_status_check
      check (playing_status in ('not_started', 'active', 'wd', 'dns', 'dq'));

alter table public.golfer_scores
  add column if not exists has_teed_off boolean not null default false;

alter table public.golfer_scores
  add column if not exists tee_time timestamptz;

comment on column public.golfer_scores.playing_status is
  'Contest-specific status: wd/dns/dq trigger protection evaluation; active/not_started for swap eligibility.';

comment on column public.golfer_scores.has_teed_off is
  'True once the golfer has teed off in this contest; used for swap eligibility.';

-- ---------------------------------------------------------------------------
-- lineup_players: UI status + scoring overlay after protection applies
-- ---------------------------------------------------------------------------
alter table public.lineup_players
  add column if not exists protection_ui_status text
    constraint lineup_players_protection_ui_status_check
      check (
        protection_ui_status is null
        or protection_ui_status in ('swap_available', 'protected', 'teed_off')
      );

alter table public.lineup_players
  add column if not exists swap_available_until timestamptz;

alter table public.lineup_players
  add column if not exists protection_applied_at timestamptz;

alter table public.lineup_players
  add column if not exists counts_as_zero_for_scoring boolean not null default false;

comment on column public.lineup_players.protection_ui_status is
  'swap_available | protected | teed_off — LIVE tags in lineup UI.';

comment on column public.lineup_players.counts_as_zero_for_scoring is
  'When true, this golfer contributes 0 fantasy points to lineup total (protected lineup remains prize-eligible).';

-- ---------------------------------------------------------------------------
-- Scoring: protected golfers score 0
-- ---------------------------------------------------------------------------
drop function if exists public.refresh_lineup_total_scores_for_contest(text) cascade;

create or replace function public.refresh_lineup_total_scores_for_contest(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else coalesce(gs.total_score, g.fantasy_points, 0)::numeric
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0)
  where l.contest_id::text = p_contest_id
    and exists (
      select 1
      from public.contest_entries ce
      where ce.contest_id::text = p_contest_id
        and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

drop function if exists public.refresh_lineup_total_scores_from_golfers() cascade;

create or replace function public.refresh_lineup_total_scores_from_golfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else coalesce(gs.total_score, g.fantasy_points, 0)::numeric
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_protection_event_atomic: credit user, debit pool, ledger, notify (single transaction)
-- ---------------------------------------------------------------------------
drop function if exists public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) cascade;

create or replace function public.apply_protection_event_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_lineup_id uuid,
  p_golfer_id uuid,
  p_event_type text,
  p_entry_fee numeric,
  p_contest_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_pool numeric;
  v_pc numeric;
  v_ce_id uuid;
  v_name text;
begin
  if p_event_type not in ('wd', 'dns', 'dq') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type.');
  end if;

  v_fee := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  if v_fee <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Entry fee must be positive.');
  end if;

  if exists (
    select 1
    from public.protection_events pe
    where pe.lineup_id = p_lineup_id
      and pe.golfer_id = p_golfer_id
      and pe.contest_id = p_contest_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Protection already applied for this golfer.');
  end if;

  select coalesce(c.name, 'Contest') into v_name
  from public.contests c
  where c.id::text = p_contest_id
  limit 1;

  select total_balance into v_pool from public.insurance_pool limit 1;
  if v_pool is null or v_pool < v_fee then
    return jsonb_build_object('ok', false, 'error', 'Community Protection Fund insufficient for this payout.');
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    round(coalesce(p.protection_credit_balance, 0)::numeric, 2)
  into v_pc
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  update public.profiles p
  set
    protection_credit_balance = round(v_pc + v_fee, 2),
    updated_at = now()
  where p.id = p_user_id;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    v_fee,
    'protection_credit',
    'Protection applied – WD/DNS/DQ event'
  );

  insert into public.insurance_transactions (
    contest_id,
    user_id,
    amount,
    type,
    description
  )
  values (
    p_contest_id::uuid,
    p_user_id,
    -v_fee,
    'insurance_payout',
    format('Protection payout — %s — %s', v_name, upper(p_event_type))
  );

  insert into public.protection_events (
    user_id,
    contest_id,
    lineup_id,
    golfer_id,
    event_type,
    protection_amount,
    contest_entry_id
  )
  values (
    p_user_id,
    p_contest_id::uuid,
    p_lineup_id,
    p_golfer_id,
    p_event_type,
    v_fee,
    p_contest_entry_id
  );

  update public.lineup_players lp
  set
    protection_ui_status = 'protected',
    protection_applied_at = now(),
    swap_available_until = null,
    counts_as_zero_for_scoring = true
  where lp.lineup_id = p_lineup_id
    and lp.golfer_id = p_golfer_id;

  insert into public.user_notifications (user_id, kind, title, body, metadata)
  values (
    p_user_id,
    'protection',
    'Protection Applied',
    'Your entry has been protected by the Community Protection Fund.',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'lineup_id', p_lineup_id,
      'golfer_id', p_golfer_id,
      'amount', v_fee
    )
  );

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object(
    'ok', true,
    'protection_amount', v_fee
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate protection event.');
  when others then
    raise;
end;
$$;

comment on function public.apply_protection_event_atomic is
  'Atomically credits protection_credit_balance, debits insurance pool, inserts ledgers and notification; zeros golfer score for lineup.';

-- ---------------------------------------------------------------------------
-- process_protection_engine_v1: scan protected lineup slots for a contest
-- ---------------------------------------------------------------------------
drop function if exists public.process_protection_engine_v1(text) cascade;

create or replace function public.process_protection_engine_v1(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_swap boolean;
  v_deadline timestamptz;
  v_status text;
  v_ev text;
  v_entry_fee numeric;
  v_ce_id uuid;
  v_res jsonb;
  n_swap int := 0;
  n_prot int := 0;
  n_skip int := 0;
begin
  for r in
    select
      lp.lineup_id,
      lp.golfer_id,
      lp.is_protected,
      lp.protection_applied_at,
      lp.protection_ui_status,
      lp.swap_available_until,
      ce.id as contest_entry_id,
      ce.user_id,
      ce.entry_fee,
      gs.playing_status,
      gs.has_teed_off,
      coalesce(g.withdrawn, false) as g_wd
    from public.lineup_players lp
    inner join public.lineups l on l.id = lp.lineup_id
    inner join public.contest_entries ce
      on ce.lineup_id = l.id
      and ce.contest_id::text = p_contest_id
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = p_contest_id
    where l.contest_id::text = p_contest_id
      and lp.is_protected = true
  loop
    if not r.is_protected then
      continue;
    end if;

    if r.protection_applied_at is not null then
      n_skip := n_skip + 1;
      continue;
    end if;

    v_status := coalesce(r.playing_status, 'not_started');
    if r.g_wd and v_status = 'not_started' then
      v_status := 'wd';
    end if;

    if coalesce(r.has_teed_off, false) = true and v_status in ('active', 'not_started') then
      update public.lineup_players lp
      set protection_ui_status = 'teed_off'
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      continue;
    end if;

    v_ev := null;
    if v_status = 'wd' or r.g_wd then
      v_ev := 'wd';
    elsif v_status = 'dns' then
      v_ev := 'dns';
    elsif v_status = 'dq' then
      v_ev := 'dq';
    end if;

    if v_ev is null then
      continue;
    end if;

    if r.protection_ui_status = 'swap_available'
       and r.swap_available_until is not null
       and r.swap_available_until > now()
       and not exists (
         select 1
         from public.protection_events pe
         where pe.lineup_id = r.lineup_id
           and pe.golfer_id = r.golfer_id
           and pe.contest_id = p_contest_id
       )
    then
      n_skip := n_skip + 1;
      continue;
    end if;

    if exists (
      select 1
      from public.protection_events pe
      where pe.lineup_id = r.lineup_id
        and pe.golfer_id = r.golfer_id
        and pe.contest_id = p_contest_id
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;

    select exists (
      select 1
      from public.golfers g2
      where not exists (
        select 1
        from public.lineup_players lp2
        where lp2.lineup_id = r.lineup_id
          and lp2.golfer_id = g2.id
      )
      and (
        not exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
        )
        or exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
            and coalesce(gs2.has_teed_off, false) = false
            and coalesce(gs2.playing_status, 'active') in ('active', 'not_started')
        )
      )
    )
    into v_swap;

    if r.swap_available_until is not null and now() >= r.swap_available_until then
      v_swap := false;
    end if;

    v_deadline := coalesce(
      (
        select min(gs3.tee_time)
        from public.golfer_scores gs3
        where gs3.contest_id = p_contest_id
          and coalesce(gs3.has_teed_off, false) = false
          and coalesce(gs3.playing_status, 'active') in ('active', 'not_started')
      ),
      now() + interval '24 hours'
    );

    if v_swap then
      update public.lineup_players lp
      set
        protection_ui_status = 'swap_available',
        swap_available_until = v_deadline
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      n_swap := n_swap + 1;
      continue;
    end if;

    v_entry_fee := round(coalesce(r.entry_fee, 0)::numeric, 2);
    v_ce_id := r.contest_entry_id;

    v_res := public.apply_protection_event_atomic(
      r.user_id,
      p_contest_id,
      r.lineup_id,
      r.golfer_id,
      v_ev,
      v_entry_fee,
      v_ce_id
    );

    if (v_res->>'ok')::boolean then
      n_prot := n_prot + 1;
    else
      n_skip := n_skip + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'swap_marked', n_swap,
    'protection_applied', n_prot,
    'skipped', n_skip
  );
end;
$$;

comment on function public.process_protection_engine_v1 is
  'Marks swap_available when replacements exist; otherwise applies protection credit atomically.';


-- ============================================================================
-- SOURCE: 065_contest_entry_protection_credit_first.sql (order 65)
-- ============================================================================

-- Contest entry: consume protection_credit_balance before account_balance; audit via protection_credit_spend.
-- (transactions_type_check: see SOURCE 060 / final 080 union.)

drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text) cascade;

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock bigint;
  v_next int;
  v_has_prof boolean;
  v_total numeric;
  v_ce_id uuid;
  prof record;
  v_balance numeric;
  v_credits numeric;
  v_pc numeric;
  v_from_pc numeric;
  v_from_cash numeric;
  v_from_pc_entry numeric;
  v_from_pc_prot numeric;
  v_cash_entry numeric;
  v_cash_prot numeric;
  v_loy int;
  v_earn int;
  v_new_loy int;
  v_new_bal numeric;
  v_new_pc numeric;
  v_tier text;
  v_ef numeric;
  v_pf numeric;
  v_cid uuid;
  v_name text;
  v_cap int;
  v_per_user int;
  n_total bigint;
  n_user bigint;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  v_cid := trim(p_contest_id)::uuid;
  v_name := coalesce(nullif(trim(p_contest_name), ''), 'Contest');

  v_ef := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  v_pf := round(greatest(coalesce(p_protection_fee, 0), 0)::numeric, 2);
  v_total := round(v_ef + v_pf, 2);

  v_lock := (hashtext(p_user_id::text || ':' || p_contest_id))::bigint;
  perform pg_advisory_xact_lock(v_lock);

  if public.contest_is_past_start(v_cid::text) then
    raise exception 'Contest has started; entries are closed.'
      using errcode = 'P0001';
  end if;

  select c.max_entries, c.max_entries_per_user
  into v_cap, v_per_user
  from public.contests c
  where c.id = v_cid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  v_cap := greatest(1, coalesce(v_cap, 1));

  select count(*)::bigint
  into n_total
  from public.contest_entries ce
  where ce.contest_id = v_cid;

  if n_total >= v_cap then
    raise exception 'This contest is full.'
      using errcode = 'P0001';
  end if;

  select count(*)::bigint
  into n_user
  from public.contest_entries ce
  where ce.contest_id = v_cid
    and ce.user_id = p_user_id;

  if n_user >= coalesce(v_per_user, 999999) then
    raise exception 'Maximum entries reached for this contest.'
      using errcode = 'P0001';
  end if;

  select coalesce(max(ce.entry_number), 0) + 1
    into v_next
    from public.contest_entries ce
    where ce.user_id = p_user_id
      and ce.contest_id = v_cid;

  if coalesce(p_total_paid, 0) <= 0 then
    insert into public.contest_entries (
      user_id,
      contest_id,
      entry_fee,
      protection_fee,
      total_paid,
      protection_enabled,
      lineup_id,
      entry_number
    )
    values (
      p_user_id,
      v_cid,
      v_ef,
      v_pf,
      0,
      coalesce(p_protection_enabled, false),
      p_lineup_id,
      v_next
    )
    returning id into v_ce_id;

    return jsonb_build_object(
      'ok', true,
      'contest_entry_id', v_ce_id,
      'credits_restored', 0,
      'balance_restored', 0,
      'protection_credit_restored', 0,
      'loyalty_points_earned', 0
    );
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    p.id,
    round(coalesce(p.account_balance, 0)::numeric, 2) as account_balance,
    round(coalesce(p.site_credits, 0)::numeric, 2) as site_credits,
    round(coalesce(p.protection_credit_balance, 0)::numeric, 2) as protection_credit_balance,
    greatest(0, floor(coalesce(p.loyalty_points, 0))::int) as loyalty_points
  into prof
  from public.profiles p
  where p.id = p_user_id
  for update;

  v_has_prof := found;
  if not v_has_prof then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  v_balance := prof.account_balance;
  v_credits := prof.site_credits;
  v_pc := prof.protection_credit_balance;
  v_loy := prof.loyalty_points;

  v_from_pc := least(v_total, v_pc);
  v_from_cash := round(v_total - v_from_pc, 2);

  if v_from_cash > v_balance then
    raise exception using
      message = format(
        'Insufficient funds for contest entry. Need $%s from account balance (have $%s) after applying $%s from protection credit (have $%s).',
        v_from_cash::text,
        v_balance::text,
        v_from_pc::text,
        v_pc::text
      ),
      errcode = 'P0001';
  end if;

  v_from_pc_entry := least(v_ef, v_from_pc);
  v_from_pc_prot := round(v_from_pc - v_from_pc_entry, 2);
  v_cash_entry := round(v_ef - v_from_pc_entry, 2);
  v_cash_prot := round(v_pf - v_from_pc_prot, 2);

  v_new_bal := round(v_balance - v_from_cash, 2);
  v_new_pc := round(v_pc - v_from_pc, 2);
  if v_new_bal < 0 or v_new_pc < 0 then
    raise exception using
      message = 'Contest entry would result in negative balances.',
      errcode = 'P0001';
  end if;

  v_earn := floor(v_ef * 10)::int;
  v_new_loy := v_loy + v_earn;
  v_tier := public.loyalty_tier_from_points(v_new_loy);

  update public.profiles p
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    protection_credit_balance = v_new_pc,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where p.id = p_user_id;

  insert into public.contest_entries (
    user_id,
    contest_id,
    entry_fee,
    protection_fee,
    total_paid,
    protection_enabled,
    lineup_id,
    entry_number
  )
  values (
    p_user_id,
    v_cid,
    v_ef,
    v_pf,
    v_total,
    coalesce(p_protection_enabled, false),
    p_lineup_id,
    v_next
  )
  returning id into v_ce_id;

  if v_from_pc > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_from_pc,
      'protection_credit_spend',
      format('Contest entry — %s (protection credit)', v_name)
    );
  end if;

  if v_cash_entry > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_cash_entry,
      'contest_entry',
      v_name
    );
  end if;

  if v_cash_prot > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_cash_prot,
      'protection_purchase',
      format('CashCaddie Protection — %s', v_name)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'contest_entry_id', v_ce_id,
    'credits_restored', 0,
    'balance_restored', v_from_cash,
    'protection_credit_restored', v_from_pc,
    'loyalty_points_earned', v_earn
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate contest entry (same user, contest, and entry slot).');
  when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'Invalid contest id (expected UUID).');
  when others then
    raise;
end;
$$;

comment on function public.create_contest_entry_atomic is
  'Creates contest_entries row; debits protection_credit_balance first, then account_balance; inserts transactions.';

-- ---------------------------------------------------------------------------
-- RLS: notifications + protection audit (read for own user)
-- ---------------------------------------------------------------------------
alter table public.user_notifications enable row level security;

drop policy if exists "Users select own notifications" on public.user_notifications;
create policy "Users select own notifications"
  on public.user_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
  on public.user_notifications for update
  using (auth.uid() = user_id);

alter table public.protection_events enable row level security;

drop policy if exists "Users select own protection events" on public.protection_events;
create policy "Users select own protection events"
  on public.protection_events for select
  using (auth.uid() = user_id);

grant select, update on public.user_notifications to authenticated;
grant select on public.protection_events to authenticated;


-- ============================================================================
-- SOURCE: 066_swap_protected_golfer_atomic.sql (order 66)
-- ============================================================================

-- Swap a protected golfer when engine marked swap_available (replacement not yet teed off).

drop function if exists public.swap_protected_lineup_golfer_atomic(uuid, uuid, uuid, uuid, text) cascade;

create or replace function public.swap_protected_lineup_golfer_atomic(
  p_user_id uuid,
  p_lineup_id uuid,
  p_old_golfer_id uuid,
  p_new_golfer_id uuid,
  p_contest_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l record;
  v_old_salary int;
  v_new_salary int;
  v_new_total int;
  v_cap int := 50000;
  v_eligible boolean;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id then
    raise exception 'Forbidden'
      using errcode = 'P0001';
  end if;

  if p_old_golfer_id = p_new_golfer_id then
    return jsonb_build_object('ok', false, 'error', 'Choose a different golfer.');
  end if;

  select l.id, l.user_id, l.contest_id, l.contest_entry_id, l.total_salary
  into v_l
  from public.lineups l
  where l.id = p_lineup_id
    and l.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Lineup not found.');
  end if;

  if v_l.contest_id is null or v_l.contest_id::text <> p_contest_id then
    return jsonb_build_object('ok', false, 'error', 'Contest mismatch.');
  end if;

  if v_l.contest_entry_id is null then
    return jsonb_build_object('ok', false, 'error', 'Lineup not entered.');
  end if;

  if not exists (
    select 1
    from public.lineup_players lp
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_old_golfer_id
      and lp.protection_ui_status = 'swap_available'
      and lp.protection_applied_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'Swap is not available for this golfer.');
  end if;

  if exists (
    select 1
    from public.lineup_players lp2
    where lp2.lineup_id = p_lineup_id
      and lp2.golfer_id = p_new_golfer_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Golfer already in lineup.');
  end if;

  select g.salary::int into v_old_salary from public.golfers g where g.id = p_old_golfer_id;
  select g.salary::int into v_new_salary from public.golfers g where g.id = p_new_golfer_id;

  if v_old_salary is null or v_new_salary is null then
    return jsonb_build_object('ok', false, 'error', 'Golfer not found.');
  end if;

  v_new_total := v_l.total_salary - v_old_salary + v_new_salary;
  if v_new_total > v_cap then
    return jsonb_build_object('ok', false, 'error', 'Salary cap exceeded.');
  end if;

  select exists (
    select 1
    from public.golfers g2
    where g2.id = p_new_golfer_id
      and (
        not exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
        )
        or exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
            and coalesce(gs2.has_teed_off, false) = false
            and coalesce(gs2.playing_status, 'active') in ('active', 'not_started')
        )
      )
  )
  into v_eligible;

  if not v_eligible then
    return jsonb_build_object(
      'ok', false,
      'error', 'Replacement golfer is not eligible (may have teed off).'
    );
  end if;

  update public.lineup_players lp
  set
    golfer_id = p_new_golfer_id,
    protection_ui_status = null,
    swap_available_until = null,
    counts_as_zero_for_scoring = false
  where lp.lineup_id = p_lineup_id
    and lp.golfer_id = p_old_golfer_id;

  update public.lineups l
  set total_salary = v_new_total
  where l.id = p_lineup_id;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Could not swap golfer (duplicate slot).');
  when others then
    raise;
end;
$$;

comment on function public.swap_protected_lineup_golfer_atomic is
  'Replaces a WD/DNS/DQ golfer when swap_available; enforces salary cap and tee-time eligibility.';

grant execute on function public.swap_protected_lineup_golfer_atomic(uuid, uuid, uuid, uuid, text) to authenticated;

grant execute on function public.process_protection_engine_v1(text) to service_role;
grant execute on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) to service_role;


-- ============================================================================
-- SOURCE: 067_approved_users_beta_allowlist.sql (order 67)
-- ============================================================================

-- Invite-only beta: only emails in public.approved_users may create auth.users rows.

create table if not exists public.approved_users (
  email text primary key,
  created_at timestamptz not null default now(),
  constraint approved_users_email_normalized check (email = lower(trim(email)))
);

comment on table public.approved_users is
  'Beta allowlist: signup is blocked unless email exists here (see trigger on auth.users).';

drop function if exists public.approved_users_normalize_email() cascade;

create or replace function public.approved_users_normalize_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists approved_users_normalize_before on public.approved_users;
create trigger approved_users_normalize_before
  before insert or update on public.approved_users
  for each row
  execute function public.approved_users_normalize_email();

alter table public.approved_users enable row level security;

grant all on table public.approved_users to postgres;
grant all on table public.approved_users to service_role;

-- Enforce allowlist before new auth user row is written.
drop function if exists public.enforce_beta_email_allowlist() cascade;

create or replace function public.enforce_beta_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.approved_users a
    where a.email = lower(trim(new.email))
  ) then
    raise exception 'CashCaddies is currently invite-only beta.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_beta_email_allowlist_before_insert on auth.users;
create trigger enforce_beta_email_allowlist_before_insert
  before insert on auth.users
  for each row
  execute function public.enforce_beta_email_allowlist();

comment on function public.enforce_beta_email_allowlist() is
  'Blocks auth signups when email is not in approved_users.';

-- After migrate: add allowed emails (normalized automatically on insert), e.g.:
-- insert into public.approved_users (email) values ('you@example.com');


-- ============================================================================
-- SOURCE: 068_lobby_read_access_grants_and_view.sql (order 68)
-- ============================================================================

-- Lobby: PostgREST/anon must read contests catalog + stats view. Security-invoker views still require
-- SELECT on base tables; grants were missing on public.contests (and golfers). Recreate the lobby view
-- with security_invoker = false so only the view grant is required for API reads (owner reads contests;
-- contest_entry_count remains SECURITY DEFINER for entry totals).

grant select on table public.contests to anon, authenticated;
grant select on table public.golfers to anon, authenticated;
grant select on table public.contest_payouts to anon, authenticated;

drop policy if exists "Anyone can read contests" on public.contests;
create policy "Anyone can read contests"
  on public.contests
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read contest_payouts" on public.contest_payouts;
create policy "Anyone can read contest_payouts"
  on public.contest_payouts
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can read golfers" on public.golfers;
create policy "Anyone can read golfers"
  on public.golfers
  for select
  to anon, authenticated
  using (true);

-- Recreate lobby view: access underlying contests as view owner (bypasses invoker needing table grant).
drop view if exists public.contests_with_stats cascade;

create view public.contests_with_stats
  with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.start_time,
  c.ends_at,
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_entry_count(c.id::text)::integer as current_entries,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on view public.contests_with_stats is
  'Lobby catalog + entry-derived stats; security_invoker=false so anon can select the view without direct contests table grant.';

alter view public.contests_with_stats owner to postgres;

grant select on table public.contests_with_stats to anon, authenticated;


-- ============================================================================
-- SOURCE: 069_closed_beta_approved_users_schema.sql (order 69)
-- ============================================================================

-- Closed beta: full approved_users shape (id, approved, notes), signup trigger copy, login RPCs, table grants/RLS.

-- 1) Extend columns (067 used email as PK only)
alter table public.approved_users add column if not exists id uuid default gen_random_uuid();
alter table public.approved_users add column if not exists approved boolean;
alter table public.approved_users add column if not exists notes text;

update public.approved_users set approved = coalesce(approved, true);
alter table public.approved_users alter column approved set default true;
alter table public.approved_users alter column approved set not null;

alter table public.approved_users alter column id set not null;

-- 2) Primary key on id; email stays unique (one-time migrate when PK is still on email from 067)
do $$
declare
  pk_on_email boolean;
begin
  select coalesce(
    bool_or(pg_get_constraintdef(c.oid) = 'PRIMARY KEY (email)'),
    false
  )
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  where t.relname = 'approved_users'
    and c.contype = 'p'
  into pk_on_email;

  if pk_on_email then
    alter table public.approved_users drop constraint approved_users_pkey;
    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on c.conrelid = t.oid
      where t.relname = 'approved_users'
        and c.conname = 'approved_users_email_key'
    ) then
      alter table public.approved_users
        add constraint approved_users_email_key unique (email);
    end if;
    alter table public.approved_users add primary key (id);
  end if;
end $$;

comment on table public.approved_users is
  'Closed beta allowlist: signup requires approved row; login gated via current_user_beta_approved().';

comment on column public.approved_users.approved is
  'When false, row is ignored for signup and login gate.';

-- 3) Signup enforcement (replace 067 message + require approved = true)
drop function if exists public.enforce_beta_email_allowlist() cascade;

create or replace function public.enforce_beta_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.approved_users a
    where a.email = lower(trim(new.email))
      and a.approved = true
  ) then
    raise exception
      'CLOSED_BETA: CashCaddies is currently in a closed beta. If you would like access, email CashCaddies@outlook.com'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- 4) Login / server helpers (SECURITY DEFINER reads allowlist; table has no anon/authenticated policies)
drop function if exists public.current_user_beta_approved() cascade;

create or replace function public.current_user_beta_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select exists (
        select 1
        from public.approved_users a
        where a.email = lower(trim(coalesce(auth.jwt()->>'email', '')))
          and a.approved = true
      )
    ),
    false
  );
$$;

comment on function public.current_user_beta_approved() is
  'True when JWT email matches an approved_users row with approved=true. For middleware / session gate.';

drop function if exists public.is_approved_user(text) cascade;

create or replace function public.is_approved_user(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := lower(trim(coalesce(p_email, '')));
  jwt_mail text := lower(trim(coalesce(auth.jwt()->>'email', '')));
begin
  if v = '' then
    return false;
  end if;
  if (select auth.role()) = 'service_role' then
    return exists (
      select 1
      from public.approved_users a
      where a.email = v
        and a.approved = true
    );
  end if;
  if jwt_mail = '' or jwt_mail <> v then
    return false;
  end if;
  return exists (
    select 1
    from public.approved_users a
    where a.email = v
      and a.approved = true
  );
end;
$$;

comment on function public.is_approved_user(text) is
  'Service role: check any email. Authenticated: only when p_email matches JWT email (no cross-email probe).';

grant execute on function public.current_user_beta_approved() to authenticated;
grant execute on function public.is_approved_user(text) to authenticated, service_role;

-- 5) Safe access: clients cannot read/modify allowlist; service_role manages rows (bypasses RLS)
revoke all on table public.approved_users from public;
revoke all on table public.approved_users from anon, authenticated;

grant all on table public.approved_users to postgres;
grant all on table public.approved_users to service_role;

alter table public.approved_users enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated => deny via RLS


-- ============================================================================
-- SOURCE: 070_seed_cashcaddies_masters_beta_example.sql (order 70)
-- ============================================================================

-- Example closed-beta contest: lobby (`contests_with_stats`), capacity, prize pool math, payouts.
--
-- Stable id for docs and deep links (lowercase UUID string in the app):
--   /lobby/c0ffee00-0000-4000-b00d-00000000be7a
--
-- Lobby compatibility:
--   - `fetchLobbyContests` reads contests_with_stats: id, name, entry_fee_usd, max_entries,
--     max_entries_per_user, current_entries, starts_at, ends_at, lineup_locked, prize_pool
--   - current_entries = contest_entry_count(contest_entries) — updates as users enter
--   - prize_pool = round(entry_fee_usd * current_entries, 2) — $0 fee => $0 pool until fee > 0
--
-- Manual checks after `supabase db push`:
--   select id, name, entry_fee_usd, max_entries, max_entries_per_user,
--          current_entries, prize_pool, lineup_locked, starts_at, ends_at
--   from public.contests_with_stats
--   where id = 'c0ffee00-0000-4000-b00d-00000000be7a'::uuid;

do $masters_beta$
declare
  v_id uuid := 'c0ffee00-0000-4000-b00d-00000000be7a';
  v_starts timestamptz := (now() + interval '30 days');
  v_ends timestamptz := (now() + interval '30 days' + interval '4 days');
begin
  if exists (select 1 from public.contests c where c.id = v_id) then
    return;
  end if;

  insert into public.contests (
    id,
    name,
    entry_fee_usd,
    max_entries,
    max_entries_per_user,
    starts_at,
    ends_at
  )
  values (
    v_id,
    'CashCaddies Masters Beta',
    0,
    50,
    3,
    v_starts,
    v_ends
  );

  insert into public.contest_payouts (contest_id, rank_place, payout_pct)
  values
    (v_id, 1, 50),
    (v_id, 2, 30),
    (v_id, 3, 20)
  on conflict (contest_id, rank_place) do nothing;
end
$masters_beta$;

-- Post-seed validation (no-op if contest row missing, e.g. partial migrate).
do $validate_masters_beta$
declare
  v_id uuid := 'c0ffee00-0000-4000-b00d-00000000be7a';
  v_row record;
  v_payouts int;
begin
  if not exists (select 1 from public.contests c where c.id = v_id) then
    return;
  end if;

  select * into strict v_row
  from public.contests_with_stats
  where id = v_id;

  if v_row.name is distinct from 'CashCaddies Masters Beta' then
    raise exception 'seed validation: unexpected contest name %', v_row.name;
  end if;
  if v_row.entry_fee_usd is distinct from 0::numeric then
    raise exception 'seed validation: entry_fee_usd should be 0, got %', v_row.entry_fee_usd;
  end if;
  if v_row.max_entries is distinct from 50 then
    raise exception 'seed validation: max_entries should be 50';
  end if;
  if v_row.max_entries_per_user is distinct from 3 then
    raise exception 'seed validation: max_entries_per_user should be 3';
  end if;
  if v_row.current_entries is distinct from 0 then
    raise exception 'seed validation: current_entries should be 0 before any entries';
  end if;
  if v_row.prize_pool is distinct from 0::numeric then
    raise exception 'seed validation: prize_pool should be 0 when fee is 0 and entries are 0';
  end if;
  if v_row.lineup_locked is not false then
    raise exception 'seed validation: lineup_locked should be false while starts_at is in the future';
  end if;
  if v_row.ends_at is null or not (v_row.starts_at < v_row.ends_at) then
    raise exception 'seed validation: ends_at must be set and after starts_at';
  end if;

  select count(*)::int
  into v_payouts
  from public.contest_payouts pp
  where pp.contest_id = v_id;

  if v_payouts < 3 then
    raise exception 'seed validation: expected at least 3 contest_payouts rows for Masters Beta';
  end if;
end
$validate_masters_beta$;


-- ============================================================================
-- SOURCE: 071_profiles_beta_management_columns.sql (order 71)
-- ============================================================================

-- Private beta admin fields on public.profiles (additive only; no changes to auth.users or existing columns).
-- Existing rows: beta_user and founding_tester become false; beta_status becomes 'pending'; beta_notes stays null.
-- Use beta_user = true to flag active beta testers; treat status as meaningful mainly when beta_user is true.

alter table public.profiles
  add column if not exists beta_user boolean not null default false;

alter table public.profiles
  add column if not exists beta_status text not null default 'pending';

alter table public.profiles
  add column if not exists founding_tester boolean not null default false;

alter table public.profiles
  add column if not exists beta_notes text;

comment on column public.profiles.beta_user is
  'True when this profile is part of the private beta cohort (admin-managed).';

comment on column public.profiles.beta_status is
  'Workflow label for beta onboarding (e.g. pending, approved, invited, active); values are app/admin conventions.';

comment on column public.profiles.founding_tester is
  'Marks early trusted testers for recognition or priority comms; admin-set.';

comment on column public.profiles.beta_notes is
  'Internal founder/admin notes; keep out of client-facing selects if exposing profiles to users.';


-- ============================================================================
-- SOURCE: 072_beta_feedback.sql (order 72)
-- ============================================================================

-- Beta tester feedback intake (additive). RLS: users insert/select own rows only.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  confusion_point text,
  feature_request text,
  bug_report text,
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_user_id_idx on public.beta_feedback (user_id);
create index if not exists beta_feedback_created_at_desc_idx on public.beta_feedback (created_at desc);

comment on table public.beta_feedback is 'Private beta product feedback; one row per submit from authenticated users.';

alter table public.beta_feedback enable row level security;

drop policy if exists "Users insert own beta feedback" on public.beta_feedback;
create policy "Users insert own beta feedback"
  on public.beta_feedback
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users select own beta feedback" on public.beta_feedback;
create policy "Users select own beta feedback"
  on public.beta_feedback
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert on table public.beta_feedback to authenticated;


-- ============================================================================
-- SOURCE: 073_founding_tester_beta_management_rpc.sql (order 73)
-- ============================================================================

-- Founding testers: list profiles and update beta / founding_tester flags on others (additive; no deletes; no auth changes).
-- Callers must have profiles.founding_tester = true. Self-target updates are rejected.

drop function if exists public.founding_tester_list_beta_profiles() cascade;

create or replace function public.founding_tester_list_beta_profiles()
returns table (
  id uuid,
  username text,
  email text,
  beta_user boolean,
  beta_status text,
  founding_tester boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.username,
    p.email,
    p.beta_user,
    p.beta_status,
    p.founding_tester,
    p.updated_at
  from public.profiles p
  where p.id <> (select auth.uid())
  order by p.updated_at desc nulls last
  limit 100;
end;
$$;

comment on function public.founding_tester_list_beta_profiles() is
  'Returns up to 100 other profiles for beta management; caller must be founding_tester.';

drop function if exists public.founding_tester_approve_beta(uuid) cascade;

create or replace function public.founding_tester_approve_beta(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  if p_target = (select auth.uid()) then
    raise exception 'cannot approve own profile via this action'
      using errcode = '42501';
  end if;

  update public.profiles
  set
    beta_user = true,
    beta_status = 'approved',
    updated_at = now()
  where id = p_target;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'profile not found'
      using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.founding_tester_approve_beta(uuid) is
  'Sets beta_user true and beta_status approved for another profile; caller must be founding_tester.';

drop function if exists public.founding_tester_toggle_founding_tester(uuid) cascade;

create or replace function public.founding_tester_toggle_founding_tester(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new boolean;
  n integer;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.founding_tester is true
  ) then
    raise exception 'not a founding tester'
      using errcode = '42501';
  end if;

  if p_target = (select auth.uid()) then
    raise exception 'cannot change own founding_tester via this action'
      using errcode = '42501';
  end if;

  update public.profiles
  set
    founding_tester = not coalesce(founding_tester, false),
    updated_at = now()
  where id = p_target
  returning founding_tester into v_new;

  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'profile not found'
      using errcode = 'P0002';
  end if;

  return v_new;
end;
$$;

comment on function public.founding_tester_toggle_founding_tester(uuid) is
  'Toggles founding_tester on another profile; caller must be founding_tester.';

grant execute on function public.founding_tester_list_beta_profiles() to authenticated;
grant execute on function public.founding_tester_approve_beta(uuid) to authenticated;
grant execute on function public.founding_tester_toggle_founding_tester(uuid) to authenticated;


-- ============================================================================
-- SOURCE: 074_closed_beta_signup_message_contact_email.sql (order 74)
-- ============================================================================

-- User-facing closed-beta signup message: public contact email (additive; replaces prior string only).

drop function if exists public.enforce_beta_email_allowlist() cascade;

create or replace function public.enforce_beta_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.approved_users a
    where a.email = lower(trim(new.email))
      and a.approved = true
  ) then
    raise exception
      'CLOSED_BETA: CashCaddies is currently in a closed beta. If you would like access, email contact@cashcaddies.com'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;


-- ============================================================================
-- SOURCE: 075_admin_feedback_management.sql (order 75)
-- ============================================================================

-- Admin feedback management: profiles.admin_user, beta_feedback.admin_status, RPCs.

alter table public.profiles
  add column if not exists admin_user boolean not null default false;

comment on column public.profiles.admin_user is
  'When true, user may access admin-only tools (e.g. beta feedback review).';

alter table public.beta_feedback
  add column if not exists admin_status text;

update public.beta_feedback set admin_status = 'new' where admin_status is null;

alter table public.beta_feedback alter column admin_status set default 'new';
alter table public.beta_feedback alter column admin_status set not null;

alter table public.beta_feedback drop constraint if exists beta_feedback_admin_status_check;

alter table public.beta_feedback
  add constraint beta_feedback_admin_status_check
  check (admin_status in ('new', 'reviewed', 'planned', 'fixed'));

comment on column public.beta_feedback.admin_status is
  'Workflow status for admins: new, reviewed, planned, fixed.';

-- List all beta feedback with submitter handle and email (admin only).
drop function if exists public.admin_user_list_beta_feedback() cascade;

create or replace function public.admin_user_list_beta_feedback()
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  rating integer,
  confusion_point text,
  feature_request text,
  bug_report text,
  admin_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
    bf.rating,
    bf.confusion_point,
    bf.feature_request,
    bf.bug_report,
    bf.admin_status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  order by bf.created_at desc;
end;
$$;

-- Update feedback workflow status (admin only).
drop function if exists public.admin_user_update_beta_feedback_status(uuid, text) cascade;

create or replace function public.admin_user_update_beta_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    raise exception 'not an admin user' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('new', 'reviewed', 'planned', 'fixed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.beta_feedback
  set admin_status = p_status
  where id = p_feedback_id;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_user_list_beta_feedback() to authenticated;
grant execute on function public.admin_user_update_beta_feedback_status(uuid, text) to authenticated;


-- ============================================================================
-- SOURCE: 076_beta_feedback_structured_type.sql (order 76)
-- ============================================================================

-- Structured beta feedback: bug vs idea, optional title and steps.

alter table public.beta_feedback
  add column if not exists feedback_type text;

update public.beta_feedback
set feedback_type = case
  when coalesce(trim(bug_report), '') <> '' then 'bug'
  else 'idea'
end
where feedback_type is null;

alter table public.beta_feedback alter column feedback_type set default 'idea';
alter table public.beta_feedback alter column feedback_type set not null;

alter table public.beta_feedback drop constraint if exists beta_feedback_feedback_type_check;

alter table public.beta_feedback
  add constraint beta_feedback_feedback_type_check
  check (feedback_type in ('bug', 'idea'));

comment on column public.beta_feedback.feedback_type is 'User-selected intake: bug report or product idea.';

alter table public.beta_feedback
  add column if not exists title text;

comment on column public.beta_feedback.title is 'Short summary line for the submission.';

alter table public.beta_feedback
  add column if not exists steps_to_reproduce text;

comment on column public.beta_feedback.steps_to_reproduce is 'Optional steps to reproduce (bug reports).';

-- Admin list: include structured fields.
drop function if exists public.admin_user_list_beta_feedback() cascade;

create or replace function public.admin_user_list_beta_feedback()
returns table (
  id uuid,
  user_id uuid,
  username text,
  email text,
  feedback_type text,
  title text,
  rating integer,
  confusion_point text,
  feature_request text,
  bug_report text,
  steps_to_reproduce text,
  admin_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
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
    bf.rating,
    bf.confusion_point,
    bf.feature_request,
    bf.bug_report,
    bf.steps_to_reproduce,
    bf.admin_status,
    bf.created_at
  from public.beta_feedback bf
  inner join public.profiles p on p.id = bf.user_id
  order by bf.created_at desc;
end;
$$;


-- ============================================================================
-- SOURCE: 077_beta_feedback_message_status.sql (order 77)
-- ============================================================================

-- beta_feedback: canonical columns message + status; optional issue_page; drop legacy columns.

alter table public.beta_feedback add column if not exists message text;
alter table public.beta_feedback add column if not exists issue_page text;
alter table public.beta_feedback add column if not exists status text;

-- Backfill message from legacy columns (072–076).
update public.beta_feedback
set message = trim(
  concat_ws(
    E'\n\n',
    case when coalesce(trim(bug_report), '') <> '' then bug_report end,
    case when coalesce(trim(feature_request), '') <> '' then feature_request end,
    case when coalesce(trim(confusion_point), '') <> '' then confusion_point end,
    case
      when coalesce(trim(steps_to_reproduce), '') <> ''
      then E'Steps to reproduce:\n' || trim(steps_to_reproduce)
    end
  )
)
where message is null;

update public.beta_feedback
set message = '(Legacy feedback)'
where message is null or trim(message) = '';

-- status: prefer admin_status (075) when present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'beta_feedback'
      and column_name = 'admin_status'
  ) then
    execute $sql$
      update public.beta_feedback
      set status = coalesce(nullif(trim(admin_status), ''), 'new')
      where status is null
    $sql$;
  end if;
end $$;

update public.beta_feedback
set status = 'new'
where status is null or trim(status) = '';

alter table public.beta_feedback drop constraint if exists beta_feedback_status_check;

alter table public.beta_feedback
  add constraint beta_feedback_status_check
  check (status in ('new', 'reviewed', 'planned', 'fixed'));

alter table public.beta_feedback alter column status set default 'new';
alter table public.beta_feedback alter column status set not null;

-- title required
update public.beta_feedback
set title = left(regexp_replace(coalesce(trim(message), 'Feedback'), E'\\s+', ' ', 'g'), 200)
where title is null or trim(title) = '';

alter table public.beta_feedback alter column title set not null;

alter table public.beta_feedback alter column message set not null;

-- Drop legacy columns
alter table public.beta_feedback drop column if exists rating;
alter table public.beta_feedback drop column if exists confusion_point;
alter table public.beta_feedback drop column if exists feature_request;
alter table public.beta_feedback drop column if exists bug_report;
alter table public.beta_feedback drop column if exists steps_to_reproduce;
alter table public.beta_feedback drop column if exists admin_status;

-- Ensure feedback_type (076) before NOT NULL constraints
update public.beta_feedback
set feedback_type = 'idea'
where feedback_type is null;

comment on column public.beta_feedback.message is 'Main feedback body.';
comment on column public.beta_feedback.issue_page is 'Optional page, URL, or area where an issue occurred.';
comment on column public.beta_feedback.status is 'Workflow: new, reviewed, planned, fixed.';

create index if not exists beta_feedback_status_new_idx on public.beta_feedback (status)
  where status = 'new';

-- Count submissions with status = new (admin only).
drop function if exists public.admin_user_new_feedback_count() cascade;

create or replace function public.admin_user_new_feedback_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    return 0;
  end if;

  select count(*)::bigint into n from public.beta_feedback where status = 'new';
  return coalesce(n, 0);
end;
$$;

grant execute on function public.admin_user_new_feedback_count() to authenticated;

drop function if exists public.admin_user_list_beta_feedback() cascade;

-- List feedback for admin; p_filter: 'all' | 'new'
drop function if exists public.admin_user_list_beta_feedback(text) cascade;

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

-- Update workflow status (column status)
drop function if exists public.admin_user_update_beta_feedback_status(uuid, text) cascade;

create or replace function public.admin_user_update_beta_feedback_status(
  p_feedback_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.admin_user is true
  ) then
    raise exception 'not an admin user' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('new', 'reviewed', 'planned', 'fixed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.beta_feedback
  set status = p_status
  where id = p_feedback_id;

  if not found then
    raise exception 'feedback not found' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.admin_user_update_beta_feedback_status(uuid, text) to authenticated;


-- ============================================================================
-- SOURCE: 078_admin_beta_wallet_credit.sql (order 78)
-- ============================================================================

-- Admin-only beta wallet funding: +$100 credit and ledger row.
-- (transactions_type_check: see SOURCE 060 / final 080 union.)

drop function if exists public.admin_add_beta_funds(numeric) cascade;

create or replace function public.admin_add_beta_funds(p_amount numeric default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_account_balance numeric;
  v_wallet_balance numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.'
      using errcode = 'P0001';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.admin_user is true
  ) then
    raise exception 'Only admin users can add beta funds.'
      using errcode = '42501';
  end if;

  -- wallet_balance is a generated alias of account_balance (038), so increment account_balance.
  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = v_uid
  returning p.account_balance, p.wallet_balance into v_new_account_balance, v_wallet_balance;

  insert into public.transactions (user_id, amount, type, description)
  values (
    v_uid,
    p_amount,
    'beta_credit',
    'Beta testing funds'
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_account_balance,
    'wallet_balance', v_wallet_balance
  );
end;
$$;

revoke all on function public.admin_add_beta_funds(numeric) from public;
grant execute on function public.admin_add_beta_funds(numeric) to authenticated;


-- ============================================================================
-- SOURCE: 079_admin_beta_wallet_funding_description.sql (order 79)
-- ============================================================================

-- Align admin beta wallet funding ledger copy.

drop function if exists public.admin_add_beta_funds(numeric) cascade;

create or replace function public.admin_add_beta_funds(p_amount numeric default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_account_balance numeric;
  v_wallet_balance numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.'
      using errcode = 'P0001';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.admin_user is true
  ) then
    raise exception 'Only admin users can add beta funds.'
      using errcode = '42501';
  end if;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = v_uid
  returning p.account_balance, p.wallet_balance into v_new_account_balance, v_wallet_balance;

  insert into public.transactions (user_id, amount, type, description)
  values (
    v_uid,
    p_amount,
    'beta_credit',
    'Beta wallet funding'
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_account_balance,
    'wallet_balance', v_wallet_balance
  );
end;
$$;


-- ============================================================================
-- SOURCE: 080_transaction_labels_and_types.sql (order 80)
-- ============================================================================

-- Normalize user-facing transaction labels/types.
-- (transactions_type_check: already applied in SOURCE 060 with same union as this migration.)

drop function if exists public.normalize_transaction_labels() cascade;

create or replace function public.normalize_transaction_labels()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_desc text := nullif(trim(coalesce(new.description, '')), '');
begin
  if new.type = 'beta_credit' then
    new.description := 'Beta Wallet Funding';
    return new;
  end if;

  if new.type = 'contest_entry' then
    if v_desc is null then
      new.description := 'Contest Entry Fee';
    elsif v_desc not ilike 'Contest Entry Fee%' then
      new.description := format('Contest Entry Fee — %s', v_desc);
    else
      new.description := v_desc;
    end if;
    return new;
  end if;

  if new.type = 'protection_purchase' then
    new.type := 'safety_coverage_fee';
  end if;

  if new.type = 'safety_coverage_fee' then
    if v_desc is null then
      new.description := 'Safety Coverage Contribution';
    elsif v_desc not ilike 'Safety Coverage Contribution%' then
      new.description := format('Safety Coverage Contribution — %s', v_desc);
    else
      new.description := v_desc;
    end if;
    return new;
  end if;

  if new.type = 'platform_fee' then
    if v_desc is null then
      new.description := 'Platform Fee';
    elsif v_desc not ilike 'Platform Fee%' then
      new.description := format('Platform Fee — %s', v_desc);
    else
      new.description := v_desc;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_transaction_labels_before_write on public.transactions;
create trigger normalize_transaction_labels_before_write
before insert or update on public.transactions
for each row execute function public.normalize_transaction_labels();


-- ============================================================================
-- SOURCE: 081_insured_golfer_required_for_entries.sql (order 81)
-- ============================================================================

-- Require one insured golfer on each contest entry.

alter table public.contest_entries
  add column if not exists insured_golfer_id uuid references public.golfers (id) on delete restrict;

comment on column public.contest_entries.insured_golfer_id is
  'Required golfer selected for CashCaddies Safety Coverage when entering a contest.';

drop function if exists public.enforce_contest_entry_insured_golfer() cascade;

create or replace function public.enforce_contest_entry_insured_golfer()
returns trigger
language plpgsql
as $$
begin
  if new.insured_golfer_id is null then
    raise exception 'CashCaddies Safety Coverage requires selecting one protected golfer (insured_golfer_id required).'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_contest_entry_insured_golfer on public.contest_entries;
create constraint trigger enforce_contest_entry_insured_golfer
after insert or update on public.contest_entries
deferrable initially deferred
for each row
execute function public.enforce_contest_entry_insured_golfer();

drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text, uuid) cascade;

create or replace function public.create_contest_entry_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_entry_fee numeric,
  p_protection_fee numeric,
  p_total_paid numeric,
  p_protection_enabled boolean,
  p_lineup_id uuid,
  p_contest_name text,
  p_insured_golfer_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_entry_id uuid;
begin
  if p_insured_golfer_id is null then
    raise exception 'CashCaddies Safety Coverage requires selecting one protected golfer (insured_golfer_id required).'
      using errcode = 'P0001';
  end if;

  v_result := public.create_contest_entry_atomic(
    p_user_id,
    p_contest_id,
    p_entry_fee,
    p_protection_fee,
    p_total_paid,
    p_protection_enabled,
    p_lineup_id,
    p_contest_name
  );

  if coalesce((v_result ->> 'ok')::boolean, false) = false then
    return v_result;
  end if;

  v_entry_id := nullif(v_result ->> 'contest_entry_id', '')::uuid;
  if v_entry_id is null then
    raise exception 'Could not determine contest entry id for insured golfer update.'
      using errcode = 'P0001';
  end if;

  update public.contest_entries
  set insured_golfer_id = p_insured_golfer_id
  where id = v_entry_id;

  return v_result;
end;
$$;

grant execute on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text, uuid
) to authenticated;


-- ============================================================================
-- SOURCE: 082_lobby_contests_protected_entry_count.sql (order 82)
-- ============================================================================

-- Lobby: contests_with_stats includes count of entries with insured_golfer_id set (protected picks).

drop view if exists public.contests_with_stats cascade;

create view public.contests_with_stats
  with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.start_time,
  c.ends_at,
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_entry_count(c.id::text)::integer as current_entries,
  (
    select count(*)::integer
    from public.contest_entries e
    where e.contest_id = c.id
      and e.insured_golfer_id is not null
  ) as protected_entries_count,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on column public.contests_with_stats.protected_entries_count is
  'Number of contest_entries for this contest with insured_golfer_id set (CashCaddies Safety Coverage pick).';

comment on view public.contests_with_stats is
  'Lobby catalog + entry-derived stats; includes protected_entries_count for activity UI.';

alter view public.contests_with_stats owner to postgres;

grant select on table public.contests_with_stats to anon, authenticated;


-- ============================================================================
-- SOURCE: 083_automatic_lineup_protection.sql (order 83)
-- ============================================================================

-- Automatic lineup protection: remove manual insured_golfer_id; track triggered protection on contest_entries.

alter table public.user_notifications
  add column if not exists email_sent_at timestamptz;

comment on column public.user_notifications.email_sent_at is
  'When set, optional outbound email for this notification was sent (server-side).';

-- Drop manual insured-golfer requirement (migration 081 wrapper + trigger).
drop function if exists public.create_contest_entry_atomic(uuid, text, numeric, numeric, numeric, boolean, uuid, text, uuid) cascade;

drop trigger if exists enforce_contest_entry_insured_golfer on public.contest_entries;
drop function if exists public.enforce_contest_entry_insured_golfer() cascade;

-- contests_with_stats (embedded 082) references contest_entries.insured_golfer_id; must drop before column removal. Recreated in embedded 084 section.
drop view if exists public.contests_with_stats cascade;

alter table public.contest_entries
  drop column if exists insured_golfer_id;

alter table public.contest_entries
  add column if not exists protection_triggered boolean not null default false,
  add column if not exists protected_golfer_id uuid references public.golfers (id) on delete set null,
  add column if not exists protection_reason text;

comment on column public.contest_entries.protection_triggered is
  'True after automatic CashCaddies protection applied (WD/DNS/DQ on a roster golfer).';

comment on column public.contest_entries.protected_golfer_id is
  'Golfer whose WD/DNS/DQ triggered automatic protection for this entry.';

comment on column public.contest_entries.protection_reason is
  'Trigger reason: WD, DNS, or DQ.';

-- apply_protection_event_atomic: set contest_entries + notification kind protection_activated
drop function if exists public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) cascade;

create or replace function public.apply_protection_event_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_lineup_id uuid,
  p_golfer_id uuid,
  p_event_type text,
  p_entry_fee numeric,
  p_contest_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_pool numeric;
  v_pc numeric;
  v_name text;
begin
  if p_event_type not in ('wd', 'dns', 'dq') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type.');
  end if;

  v_fee := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);
  if v_fee <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Entry fee must be positive.');
  end if;

  if exists (
    select 1
    from public.protection_events pe
    where pe.lineup_id = p_lineup_id
      and pe.golfer_id = p_golfer_id
      and pe.contest_id = p_contest_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Protection already applied for this golfer.');
  end if;

  select coalesce(c.name, 'Contest') into v_name
  from public.contests c
  where c.id::text = p_contest_id
  limit 1;

  select total_balance into v_pool from public.insurance_pool limit 1;
  if v_pool is null or v_pool < v_fee then
    return jsonb_build_object('ok', false, 'error', 'Community Protection Fund insufficient for this payout.');
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  select
    round(coalesce(p.protection_credit_balance, 0)::numeric, 2)
  into v_pc
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found.');
  end if;

  update public.profiles p
  set
    protection_credit_balance = round(v_pc + v_fee, 2),
    updated_at = now()
  where p.id = p_user_id;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    v_fee,
    'protection_credit',
    'Protection applied – WD/DNS/DQ event'
  );

  insert into public.insurance_transactions (
    contest_id,
    user_id,
    amount,
    type,
    description
  )
  values (
    p_contest_id::uuid,
    p_user_id,
    -v_fee,
    'insurance_payout',
    format('Protection payout — %s — %s', v_name, upper(p_event_type))
  );

  insert into public.protection_events (
    user_id,
    contest_id,
    lineup_id,
    golfer_id,
    event_type,
    protection_amount,
    contest_entry_id
  )
  values (
    p_user_id,
    p_contest_id::uuid,
    p_lineup_id,
    p_golfer_id,
    p_event_type,
    v_fee,
    p_contest_entry_id
  );

  update public.contest_entries ce
  set
    protection_triggered = true,
    protected_golfer_id = p_golfer_id,
    protection_reason = upper(p_event_type)
  where ce.id = p_contest_entry_id;

  update public.lineup_players lp
  set
    protection_ui_status = 'protected',
    protection_applied_at = now(),
    swap_available_until = null,
    counts_as_zero_for_scoring = true
  where lp.lineup_id = p_lineup_id
    and lp.golfer_id = p_golfer_id;

  insert into public.user_notifications (user_id, kind, title, body, metadata)
  values (
    p_user_id,
    'protection_activated',
    'Protection Activated',
    'Your lineup was automatically protected because a golfer withdrew, was disqualified, or did not start.',
    jsonb_build_object(
      'contest_id', p_contest_id,
      'lineup_id', p_lineup_id,
      'golfer_id', p_golfer_id,
      'amount', v_fee,
      'reason', upper(p_event_type)
    )
  );

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object(
    'ok', true,
    'protection_amount', v_fee
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate protection event.');
  when others then
    raise;
end;
$$;

comment on function public.apply_protection_event_atomic is
  'Automatic lineup protection: credit user, update contest_entries, notify (protection_activated).';

-- process_protection_engine_v1: evaluate all roster golfers (not only is_protected)
drop function if exists public.process_protection_engine_v1(text) cascade;

create or replace function public.process_protection_engine_v1(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_swap boolean;
  v_deadline timestamptz;
  v_status text;
  v_ev text;
  v_entry_fee numeric;
  v_ce_id uuid;
  v_res jsonb;
  n_swap int := 0;
  n_prot int := 0;
  n_skip int := 0;
begin
  for r in
    select
      lp.lineup_id,
      lp.golfer_id,
      lp.protection_applied_at,
      lp.protection_ui_status,
      lp.swap_available_until,
      ce.id as contest_entry_id,
      ce.user_id,
      ce.entry_fee,
      gs.playing_status,
      gs.has_teed_off,
      coalesce(g.withdrawn, false) as g_wd
    from public.lineup_players lp
    inner join public.lineups l on l.id = lp.lineup_id
    inner join public.contest_entries ce
      on ce.lineup_id = l.id
      and ce.contest_id::text = p_contest_id
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = p_contest_id
    where l.contest_id::text = p_contest_id
  loop
    if r.protection_applied_at is not null then
      n_skip := n_skip + 1;
      continue;
    end if;

    v_status := coalesce(r.playing_status, 'not_started');
    if r.g_wd and v_status = 'not_started' then
      v_status := 'wd';
    end if;

    if coalesce(r.has_teed_off, false) = true and v_status in ('active', 'not_started') then
      update public.lineup_players lp
      set protection_ui_status = 'teed_off'
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      continue;
    end if;

    v_ev := null;
    if v_status = 'wd' or r.g_wd then
      v_ev := 'wd';
    elsif v_status = 'dns' then
      v_ev := 'dns';
    elsif v_status = 'dq' then
      v_ev := 'dq';
    end if;

    if v_ev is null then
      continue;
    end if;

    if r.protection_ui_status = 'swap_available'
       and r.swap_available_until is not null
       and r.swap_available_until > now()
       and not exists (
         select 1
         from public.protection_events pe
         where pe.lineup_id = r.lineup_id
           and pe.golfer_id = r.golfer_id
           and pe.contest_id = p_contest_id
       )
    then
      n_skip := n_skip + 1;
      continue;
    end if;

    if exists (
      select 1
      from public.protection_events pe
      where pe.lineup_id = r.lineup_id
        and pe.golfer_id = r.golfer_id
        and pe.contest_id = p_contest_id
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;

    select exists (
      select 1
      from public.golfers g2
      where not exists (
        select 1
        from public.lineup_players lp2
        where lp2.lineup_id = r.lineup_id
          and lp2.golfer_id = g2.id
      )
      and (
        not exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
        )
        or exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
            and coalesce(gs2.has_teed_off, false) = false
            and coalesce(gs2.playing_status, 'active') in ('active', 'not_started')
        )
      )
    )
    into v_swap;

    if r.swap_available_until is not null and now() >= r.swap_available_until then
      v_swap := false;
    end if;

    v_deadline := coalesce(
      (
        select min(gs3.tee_time)
        from public.golfer_scores gs3
        where gs3.contest_id = p_contest_id
          and coalesce(gs3.has_teed_off, false) = false
          and coalesce(gs3.playing_status, 'active') in ('active', 'not_started')
      ),
      now() + interval '24 hours'
    );

    if v_swap then
      update public.lineup_players lp
      set
        protection_ui_status = 'swap_available',
        swap_available_until = v_deadline
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      n_swap := n_swap + 1;
      continue;
    end if;

    v_entry_fee := round(coalesce(r.entry_fee, 0)::numeric, 2);
    v_ce_id := r.contest_entry_id;

    v_res := public.apply_protection_event_atomic(
      r.user_id,
      p_contest_id,
      r.lineup_id,
      r.golfer_id,
      v_ev,
      v_entry_fee,
      v_ce_id
    );

    if (v_res->>'ok')::boolean then
      n_prot := n_prot + 1;
    else
      n_skip := n_skip + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'swap_marked', n_swap,
    'protection_applied', n_prot,
    'skipped', n_skip
  );
end;
$$;

comment on function public.process_protection_engine_v1 is
  'WD/DNS/DQ on any roster golfer: swap window or automatic lineup protection (all roster slots).';


-- ============================================================================
-- SOURCE: 084_lobby_contests_protection_triggered_count.sql (order 84)
-- ============================================================================

-- Lobby stats: count entries where automatic protection has triggered (replaces insured_golfer_id count).

drop view if exists public.contests_with_stats cascade;

create view public.contests_with_stats
  with (security_invoker = false)
as
select
  c.id,
  c.name,
  c.entry_fee_usd,
  c.max_entries,
  c.max_entries_per_user,
  c.starts_at,
  c.start_time,
  c.ends_at,
  (now() >= c.starts_at) as lineup_locked,
  c.created_at,
  public.contest_entry_count(c.id::text)::integer as current_entries,
  (
    select count(*)::integer
    from public.contest_entries e
    where e.contest_id = c.id
      and coalesce(e.protection_triggered, false) = true
  ) as protected_entries_count,
  round(
    c.entry_fee_usd * public.contest_entry_count(c.id::text)::numeric,
    2
  ) as prize_pool
from public.contests c;

comment on column public.contests_with_stats.protected_entries_count is
  'Entries with automatic protection triggered (protection_triggered).';

comment on view public.contests_with_stats is
  'Lobby catalog + entry-derived stats; protected_entries_count = triggered automatic protection.';

alter view public.contests_with_stats owner to postgres;

grant select on table public.contests_with_stats to anon, authenticated;


-- ============================================================================
-- SOURCE: 085_safety_coverage_tokens.sql (order 85)
-- ============================================================================

-- Safety Coverage Token model: ledger tokens (pre–Round-1 WD/DNS/DQ), finish-only strip (post–tee WD/DQ).

-- ---------------------------------------------------------------------------
-- golfer_scores: optional finish-position bonus (separate from DFS performance)
-- ---------------------------------------------------------------------------
alter table public.golfer_scores
  add column if not exists finish_position_points numeric not null default 0
    constraint golfer_scores_finish_position_points_check check (finish_position_points >= 0);

comment on column public.golfer_scores.finish_position_points is
  'Tournament finish / placement bonus points; excluded for post–Round-1 WD/DQ when lineup_players.exclude_finish_position_points is true.';

-- ---------------------------------------------------------------------------
-- lineup_players: post–Round-1 WD/DQ — keep DFS performance, drop finish points only
-- ---------------------------------------------------------------------------
alter table public.lineup_players
  add column if not exists exclude_finish_position_points boolean not null default false;

comment on column public.lineup_players.exclude_finish_position_points is
  'When true, this golfer contributes golfer_scores.total_score (DFS) only toward lineup total (no finish_position_points).';

-- ---------------------------------------------------------------------------
-- contest_entries: token issuance flag
-- ---------------------------------------------------------------------------
alter table public.contest_entries
  add column if not exists protection_token_issued boolean not null default false;

comment on column public.contest_entries.protection_token_issued is
  'True when a Safety Coverage Token was issued for this entry (pre–Round-1 WD/DNS/DQ).';

-- ---------------------------------------------------------------------------
-- safety_tokens: one row per contest entry max (unique on contest_entry_id)
-- ---------------------------------------------------------------------------
create table if not exists public.safety_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id uuid not null references public.contests (id) on delete cascade,
  contest_entry_id uuid not null references public.contest_entries (id) on delete cascade,
  golfer_id uuid references public.golfers (id) on delete set null,
  token_value numeric not null check (token_value >= 0),
  status text not null default 'active',
  issued_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint safety_tokens_contest_entry_id_key unique (contest_entry_id),
  constraint safety_tokens_status_check check (status in ('active', 'redeemed', 'expired', 'void'))
);

create index if not exists safety_tokens_user_created_idx
  on public.safety_tokens (user_id, created_at desc);

comment on table public.safety_tokens is
  'Safety Coverage Token ledger: pre–Round-1 WD/DNS/DQ; token_value typically equals contest entry fee.';

alter table public.safety_tokens enable row level security;

drop policy if exists "Users select own safety_tokens" on public.safety_tokens;
create policy "Users select own safety_tokens"
  on public.safety_tokens
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.safety_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- Scoring: DFS + optional finish; protected slot = 0; exclude_finish strips finish only
-- ---------------------------------------------------------------------------
drop function if exists public.refresh_lineup_total_scores_for_contest(text) cascade;

create or replace function public.refresh_lineup_total_scores_for_contest(p_contest_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else
              coalesce(gs.total_score, g.fantasy_points, 0)::numeric
              + case
                  when coalesce(lp.exclude_finish_position_points, false) then 0::numeric
                  else coalesce(gs.finish_position_points, 0)::numeric
                end
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0)
  where l.contest_id::text = p_contest_id
    and exists (
      select 1
      from public.contest_entries ce
      where ce.contest_id::text = p_contest_id
        and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
    );

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

drop function if exists public.refresh_lineup_total_scores_from_golfers() cascade;

create or replace function public.refresh_lineup_total_scores_from_golfers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then
          case
            when lp.counts_as_zero_for_scoring then 0::numeric
            else
              coalesce(gs.total_score, g.fantasy_points, 0)::numeric
              + case
                  when coalesce(lp.exclude_finish_position_points, false) then 0::numeric
                  else coalesce(gs.finish_position_points, 0)::numeric
                end
          end
        else coalesce(g.fantasy_points, 0)::numeric
      end
    )::numeric
    from public.lineup_players lp
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = l.contest_id
    where lp.lineup_id = l.id
  ), 0);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_protection_event_atomic: token path (pre–tee) vs post–tee scoring strip
-- ---------------------------------------------------------------------------
drop function if exists public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid) cascade;

drop function if exists public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid, boolean) cascade;

create or replace function public.apply_protection_event_atomic(
  p_user_id uuid,
  p_contest_id text,
  p_lineup_id uuid,
  p_golfer_id uuid,
  p_event_type text,
  p_entry_fee numeric,
  p_contest_entry_id uuid,
  p_issue_safety_token boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
  v_name text;
  v_golfer_name text;
  v_issued_reason text;
  v_body text;
begin
  if p_event_type not in ('wd', 'dns', 'dq') then
    return jsonb_build_object('ok', false, 'error', 'Invalid event type.');
  end if;

  v_fee := round(greatest(coalesce(p_entry_fee, 0), 0)::numeric, 2);

  if exists (
    select 1
    from public.protection_events pe
    where pe.lineup_id = p_lineup_id
      and pe.golfer_id = p_golfer_id
      and pe.contest_id = p_contest_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Protection already applied for this golfer.');
  end if;

  select coalesce(c.name, 'Contest') into v_name
  from public.contests c
  where c.id::text = p_contest_id
  limit 1;

  select coalesce(g.name, 'Golfer') into v_golfer_name
  from public.golfers g
  where g.id = p_golfer_id;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  v_issued_reason := case p_event_type
    when 'wd' then 'WD protection'
    when 'dns' then 'DNS protection'
    else 'DQ protection'
  end;

  if p_issue_safety_token then
    if exists (
      select 1 from public.safety_tokens st where st.contest_entry_id = p_contest_entry_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'Safety token already issued for this entry.');
    end if;

    insert into public.safety_tokens (
      user_id,
      contest_id,
      contest_entry_id,
      golfer_id,
      token_value,
      status,
      issued_reason,
      expires_at
    )
    values (
      p_user_id,
      p_contest_id::uuid,
      p_contest_entry_id,
      p_golfer_id,
      v_fee,
      'active',
      v_issued_reason,
      null
    );

    insert into public.protection_events (
      user_id,
      contest_id,
      lineup_id,
      golfer_id,
      event_type,
      protection_amount,
      contest_entry_id
    )
    values (
      p_user_id,
      p_contest_id::uuid,
      p_lineup_id,
      p_golfer_id,
      p_event_type,
      v_fee,
      p_contest_entry_id
    );

    update public.contest_entries ce
    set
      protection_triggered = true,
      protection_token_issued = true,
      protected_golfer_id = p_golfer_id,
      protection_reason = upper(p_event_type)
    where ce.id = p_contest_entry_id;

    update public.lineup_players lp
    set
      protection_ui_status = 'protected',
      protection_applied_at = now(),
      swap_available_until = null,
      counts_as_zero_for_scoring = true,
      exclude_finish_position_points = false
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_golfer_id;

    v_body :=
      E'Safety Coverage Activated\n\nGolfer:\n'
      || v_golfer_name
      || E'\n\nToken Issued:\n$'
      || trim(to_char(v_fee, 'FM999999990.00'))
      || E'\n';

    insert into public.user_notifications (user_id, kind, title, body, metadata)
    values (
      p_user_id,
      'safety_coverage_activated',
      'Safety Coverage Activated',
      v_body,
      jsonb_build_object(
        'contest_id', p_contest_id,
        'lineup_id', p_lineup_id,
        'golfer_id', p_golfer_id,
        'golfer_name', v_golfer_name,
        'token_amount', v_fee,
        'reason', upper(p_event_type)
      )
    );
  else
    insert into public.protection_events (
      user_id,
      contest_id,
      lineup_id,
      golfer_id,
      event_type,
      protection_amount,
      contest_entry_id
    )
    values (
      p_user_id,
      p_contest_id,
      p_lineup_id,
      p_golfer_id,
      p_event_type,
      0,
      p_contest_entry_id
    );

    update public.contest_entries ce
    set
      protection_triggered = true,
      protection_token_issued = false,
      protected_golfer_id = p_golfer_id,
      protection_reason = upper(p_event_type) || '_POST_R1'
    where ce.id = p_contest_entry_id;

    update public.lineup_players lp
    set
      protection_ui_status = coalesce(lp.protection_ui_status, 'teed_off'),
      exclude_finish_position_points = true,
      counts_as_zero_for_scoring = false
    where lp.lineup_id = p_lineup_id
      and lp.golfer_id = p_golfer_id;
  end if;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  return jsonb_build_object(
    'ok', true,
    'protection_amount', case when p_issue_safety_token then v_fee else 0::numeric end,
    'safety_token_issued', p_issue_safety_token
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'Duplicate protection event.');
  when others then
    raise;
end;
$$;

comment on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid, boolean) is
  'Pre–Round-1 tee: issue Safety Coverage Token + zero slot DFS+finish; post–tee WD/DQ: strip finish_position_points only.';

grant execute on function public.apply_protection_event_atomic(uuid, text, uuid, uuid, text, numeric, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- process_protection_engine_v1: branch on has_teed_off (Round-1 tee proxy)
-- ---------------------------------------------------------------------------
drop function if exists public.process_protection_engine_v1(text) cascade;

create or replace function public.process_protection_engine_v1(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_swap boolean;
  v_deadline timestamptz;
  v_status text;
  v_ev text;
  v_entry_fee numeric;
  v_ce_id uuid;
  v_res jsonb;
  v_issue_token boolean;
  n_swap int := 0;
  n_prot int := 0;
  n_skip int := 0;
begin
  for r in
    select
      lp.lineup_id,
      lp.golfer_id,
      lp.protection_applied_at,
      lp.protection_ui_status,
      lp.swap_available_until,
      ce.id as contest_entry_id,
      ce.user_id,
      ce.entry_fee,
      gs.playing_status,
      gs.has_teed_off,
      coalesce(g.withdrawn, false) as g_wd
    from public.lineup_players lp
    inner join public.lineups l on l.id = lp.lineup_id
    inner join public.contest_entries ce
      on ce.lineup_id = l.id
      and ce.contest_id::text = p_contest_id
    inner join public.golfers g on g.id = lp.golfer_id
    left join public.golfer_scores gs
      on gs.golfer_id = lp.golfer_id
      and gs.contest_id = p_contest_id
    where l.contest_id::text = p_contest_id
  loop
    if r.protection_applied_at is not null then
      n_skip := n_skip + 1;
      continue;
    end if;

    v_status := coalesce(r.playing_status, 'not_started');
    if r.g_wd and v_status = 'not_started' then
      v_status := 'wd';
    end if;

    if coalesce(r.has_teed_off, false) = true and v_status in ('active', 'not_started') then
      update public.lineup_players lp
      set protection_ui_status = 'teed_off'
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      continue;
    end if;

    v_ev := null;
    if v_status = 'wd' or r.g_wd then
      v_ev := 'wd';
    elsif v_status = 'dns' then
      v_ev := 'dns';
    elsif v_status = 'dq' then
      v_ev := 'dq';
    end if;

    if v_ev is null then
      continue;
    end if;

    if r.protection_ui_status = 'swap_available'
       and r.swap_available_until is not null
       and r.swap_available_until > now()
       and not exists (
         select 1
         from public.protection_events pe
         where pe.lineup_id = r.lineup_id
           and pe.golfer_id = r.golfer_id
           and pe.contest_id = p_contest_id
       )
    then
      n_skip := n_skip + 1;
      continue;
    end if;

    if exists (
      select 1
      from public.protection_events pe
      where pe.lineup_id = r.lineup_id
        and pe.golfer_id = r.golfer_id
        and pe.contest_id = p_contest_id
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;

    select exists (
      select 1
      from public.golfers g2
      where not exists (
        select 1
        from public.lineup_players lp2
        where lp2.lineup_id = r.lineup_id
          and lp2.golfer_id = g2.id
      )
      and (
        not exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
        )
        or exists (
          select 1
          from public.golfer_scores gs2
          where gs2.golfer_id = g2.id
            and gs2.contest_id = p_contest_id
            and coalesce(gs2.has_teed_off, false) = false
            and coalesce(gs2.playing_status, 'active') in ('active', 'not_started')
        )
      )
    )
    into v_swap;

    if r.swap_available_until is not null and now() >= r.swap_available_until then
      v_swap := false;
    end if;

    v_deadline := coalesce(
      (
        select min(gs3.tee_time)
        from public.golfer_scores gs3
        where gs3.contest_id = p_contest_id
          and coalesce(gs3.has_teed_off, false) = false
          and coalesce(gs3.playing_status, 'active') in ('active', 'not_started')
      ),
      now() + interval '24 hours'
    );

    if v_swap then
      update public.lineup_players lp
      set
        protection_ui_status = 'swap_available',
        swap_available_until = v_deadline
      where lp.lineup_id = r.lineup_id
        and lp.golfer_id = r.golfer_id
        and coalesce(lp.protection_applied_at, null) is null;
      n_swap := n_swap + 1;
      continue;
    end if;

    v_issue_token := coalesce(r.has_teed_off, false) = false;

    v_entry_fee := round(coalesce(r.entry_fee, 0)::numeric, 2);
    v_ce_id := r.contest_entry_id;

    v_res := public.apply_protection_event_atomic(
      r.user_id,
      p_contest_id,
      r.lineup_id,
      r.golfer_id,
      v_ev,
      v_entry_fee,
      v_ce_id,
      v_issue_token
    );

    if (v_res->>'ok')::boolean then
      n_prot := n_prot + 1;
    else
      n_skip := n_skip + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'swap_marked', n_swap,
    'protection_applied', n_prot,
    'skipped', n_skip
  );
end;
$$;

comment on function public.process_protection_engine_v1 is
  'WD/DNS/DQ: pre–Round-1 tee (has_teed_off false) issues Safety Coverage Token; post–tee strips finish points only.';


-- ============================================================================
-- SOURCE: 086_contest_lab_simulations.sql (order 86)
-- ============================================================================

-- Contest Lab (Simulation Engine): hypothetical entry simulations; never mutates contest data.

do $cc_lab_enum_scope$ begin
  create type public.simulation_scope as enum ('ENTRY', 'CONTEST');
exception when duplicate_object then null;
end $cc_lab_enum_scope$;

do $cc_lab_enum_scenario$ begin
  create type public.simulation_scenario as enum (
    'WD',
    'RANDOM_WD',
    'BAD_ROUND',
    'HOT_ROUND',
    'MISS_CUT',
    'CHAOS'
  );
exception when duplicate_object then null;
end $cc_lab_enum_scenario$;

create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contest_id uuid not null references public.contests (id) on delete cascade,
  entry_id uuid references public.contest_entries (id) on delete cascade,
  simulation_type public.simulation_scope not null default 'ENTRY',
  scenario public.simulation_scenario not null,
  affected_golfer_id uuid references public.golfers (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint simulations_entry_scope_check check (
    (simulation_type = 'ENTRY' and entry_id is not null)
    or simulation_type = 'CONTEST'
  )
);

create index if not exists simulations_user_created_idx on public.simulations (user_id, created_at desc);
create index if not exists simulations_entry_idx on public.simulations (entry_id);

comment on table public.simulations is
  'Contest Lab: user-run hypothetical scenarios; ENTRY scope ties to contest_entries; CONTEST reserved for future full-field sims.';

create table if not exists public.simulation_results (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  entry_id uuid not null references public.contest_entries (id) on delete cascade,
  simulated_score numeric not null,
  simulated_position integer not null check (simulated_position >= 1),
  previous_position integer not null check (previous_position >= 1),
  position_change integer not null,
  created_at timestamptz not null default now()
);

create index if not exists simulation_results_simulation_idx on public.simulation_results (simulation_id);

comment on table public.simulation_results is
  'Contest Lab output: projected score/rank vs leaderboard snapshot at run time; position_change = previous_position - simulated_position (positive = moved up).';

comment on column public.simulation_results.position_change is
  'previous_position minus simulated_position; positive means improved standing (lower rank number).';

alter table public.simulations enable row level security;
alter table public.simulation_results enable row level security;

drop policy if exists "Users read own simulations" on public.simulations;
create policy "Users read own simulations"
  on public.simulations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own simulations" on public.simulations;
create policy "Users insert own simulations"
  on public.simulations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own simulation_results" on public.simulation_results;
create policy "Users read own simulation_results"
  on public.simulation_results
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.simulations s
      where s.id = simulation_results.simulation_id
        and s.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users insert own simulation_results" on public.simulation_results;
create policy "Users insert own simulation_results"
  on public.simulation_results
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.simulations s
      where s.id = simulation_results.simulation_id
        and s.user_id = (select auth.uid())
    )
  );

grant select, insert on public.simulations to authenticated;
grant select, insert on public.simulation_results to authenticated;


-- ============================================================================
-- SOURCE: 087_contest_lab_text_columns_and_risk.sql (order 87)
-- ============================================================================

-- Contest Lab: text columns for scenario/type, score columns on results (risk meter).

alter table public.simulation_results
  add column if not exists previous_score numeric,
  add column if not exists score_change numeric;

comment on column public.simulation_results.previous_score is
  'Leaderboard snapshot score for this entry before applying the hypothetical scenario.';

comment on column public.simulation_results.score_change is
  'simulated_score minus previous_score.';

-- Migrate enum columns to text (if migration 086 created enums).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'scenario'
      and udt_name = 'simulation_scenario'
  ) then
    alter table public.simulations alter column scenario type text using scenario::text;
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
      and udt_name = 'simulation_scope'
  ) then
    alter table public.simulations alter column simulation_type type text using simulation_type::text;
  end if;
end $$;

alter table public.simulations
  drop constraint if exists simulations_entry_scope_check;

alter table public.simulations
  add constraint simulations_entry_scope_check check (
    (simulation_type = 'ENTRY' and entry_id is not null)
    or simulation_type = 'CONTEST'
  );

alter table public.simulations
  drop constraint if exists simulations_simulation_type_check;

alter table public.simulations
  add constraint simulations_simulation_type_check check (simulation_type in ('ENTRY', 'CONTEST'));

drop type if exists public.simulation_scenario cascade;
drop type if exists public.simulation_scope cascade;

