


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."simulation_scope" AS ENUM (
    'ENTRY',
    'CONTEST'
);


ALTER TYPE "public"."simulation_scope" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_new_bal numeric;
  v_allow text;
begin
  select c.value
    into v_allow
  from public.app_config c
  where c.key = 'allow_test_wallet_funding';

  if v_allow is null or lower(trim(v_allow)) is distinct from 'true' then
    raise exception
      'Test wallet funding is disabled (app_config.allow_test_wallet_funding is not true).'
      using errcode = 'P0001';
  end if;

  if auth.uid() is null or auth.uid() is distinct from p_user_id then
    raise exception 'You can only add test funds to your own account.'
      using errcode = 'P0001';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive.'
      using errcode = 'P0001';
  end if;

  if p_amount > 10000 then
    raise exception 'Amount exceeds maximum for test funding.'
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id)
  values (p_user_id)
  on conflict (id) do nothing;

  update public.profiles p
  set
    account_balance = round(coalesce(p.account_balance, 0)::numeric + p_amount, 2),
    updated_at = now()
  where p.id = p_user_id
  returning p.account_balance into v_new_bal;

  insert into public.transactions (user_id, amount, type, description)
  values (
    p_user_id,
    p_amount,
    'test_credit',
    format('Development test wallet credit ($%s)', p_amount::text)
  );

  return jsonb_build_object(
    'ok', true,
    'account_balance', v_new_bal
  );
end;
$_$;


ALTER FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) IS 'Dev-only: credits account_balance and inserts test_credit when app_config.allow_test_wallet_funding = true.';



CREATE OR REPLACE FUNCTION "public"."admin_add_beta_funds"("p_amount" numeric DEFAULT 100) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_new_account_balance numeric;
  v_wallet_balance numeric;
  v_prev numeric;
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

  select coalesce(p.account_balance, 0) into v_prev
  from public.profiles p
  where p.id = v_uid;

  if round(v_prev::numeric + p_amount, 2) > 5000::numeric then
    raise exception 'Wallet limit exceeded – contact admin'
      using errcode = 'P0001';
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


ALTER FUNCTION "public"."admin_add_beta_funds"("p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_cashcaddies_safety_coverage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$

BEGIN

NEW.entry_fee_total := NEW.entry_fee;

NEW.prize_contribution := ROUND(NEW.entry_fee * .90,2);

NEW.platform_fee := ROUND(NEW.entry_fee * .05,2);

NEW.safety_coverage_fee := ROUND(NEW.entry_fee * .05,2);

UPDATE safety_coverage_fund

SET

total_balance = total_balance + NEW.safety_coverage_fee,

total_collected = total_collected + NEW.safety_coverage_fee

WHERE id = 1;

RETURN NEW;

END;

$$;


ALTER FUNCTION "public"."apply_cashcaddies_safety_coverage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_random_golfer_scores"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  update public.golfers
  set fantasy_points = round((35 + random() * 60)::numeric, 1);
  get diagnostics n = row_count;
  perform public.refresh_lineup_total_scores_from_golfers();
  return coalesce(n, 0);
end;
$$;


ALTER FUNCTION "public"."assign_random_golfer_scores"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contest_entries_sync_entry_count_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_contest_entry_count(new.contest_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.sync_contest_entry_count(old.contest_id);
    return old;
  else
    if old.contest_id is distinct from new.contest_id then
      perform public.sync_contest_entry_count(old.contest_id);
    end if;
    perform public.sync_contest_entry_count(new.contest_id);
    return new;
  end if;
end;
$$;


ALTER FUNCTION "public"."contest_entries_sync_entry_count_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contest_entry_count"("p_contest_id" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::bigint
  from public.contest_entries ce
  where ce.contest_id::text = p_contest_id;
$$;


ALTER FUNCTION "public"."contest_entry_count"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."contest_entry_count"("p_contest_id" "text") IS 'Number of contest_entries rows for this contest (capacity).';



CREATE OR REPLACE FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.contests c
    where c.id::text = p_contest_id
      and now() >= c.starts_at
  );
$$;


ALTER FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") IS 'True when now() >= contests.starts_at (authoritative start time).';



CREATE OR REPLACE FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") RETURNS TABLE("lineup_id" "uuid", "user_id" "uuid", "total_score" numeric, "username" "text", "email" "text", "total_salary" numeric, "protection_enabled" boolean, "entry_number" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select
    q.lineup_id,
    q.user_id,
    q.total_score,
    q.username,
    q.email,
    q.total_salary,
    q.protection_enabled,
    q.entry_number
  from (
    select
      l.id as lineup_id,
      ce.user_id,
      coalesce(l.total_score, 0)::numeric as total_score,
      nullif(trim(p.username), '')::text as username,
      nullif(trim(p.email), '')::text as email,
      coalesce(l.total_salary, 0)::numeric as total_salary,
      ce.protection_enabled,
      row_number() over (
        partition by ce.user_id
        order by ce.created_at asc, ce.id asc
      )::integer as entry_number
    from public.contest_entries ce
    inner join public.lineups l
      on (
        l.id = ce.lineup_id
        or (ce.lineup_id is null and l.contest_entry_id = ce.id)
      )
    inner join public.profiles p on p.id = ce.user_id
    where ce.contest_id::text = p_contest_id
  ) q
  order by q.total_score desc nulls last, q.lineup_id;
$$;


ALTER FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") IS 'Leaderboard: profiles.username + email; ORDER BY total_score DESC.';



CREATE OR REPLACE FUNCTION "public"."contest_leaderboard"("p_contest_id" "uuid") RETURNS TABLE("email" "text", "total_score" numeric, "total_salary" integer, "protection_enabled" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
select
 coalesce(au.email,'unknown') as email,
 l.total_score,
 l.total_salary,
 ce.protection_enabled
from contest_entries ce
join lineups l on l.id = ce.lineup_id
left join auth.users au on au.id = ce.user_id
where ce.contest_id = p_contest_id
order by l.total_score desc;
$$;


ALTER FUNCTION "public"."contest_leaderboard"("p_contest_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."contest_lineup_count"("p_contest_id" "text") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select count(*)::bigint from public.lineups l where l.contest_id = p_contest_id;
$$;


ALTER FUNCTION "public"."contest_lineup_count"("p_contest_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
begin
  v_cid := trim(p_contest_id)::uuid;

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
      'entry',
      format('Contest entry - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), v_cid::text)
    );
  end if;

  if v_pf > 0 then
    insert into public.transactions (user_id, amount, type, description)
    values (
      p_user_id,
      -v_pf,
      'protection_purchase',
      format('CashCaddie Protection - %s (%s)', coalesce(nullif(trim(p_contest_name), ''), 'Contest'), v_cid::text)
    );
  end if;

  update public.profiles
  set
    site_credits = v_credits,
    account_balance = v_new_bal,
    loyalty_points = v_new_loy,
    loyalty_tier = v_tier,
    updated_at = now()
  where id = p_user_id;

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
$_$;


ALTER FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") IS 'Atomic: contest_entries + wallet debit from account_balance only. Insufficient balance raises (rollback). Balance cannot go negative (CHECK + runtime assert).';



CREATE OR REPLACE FUNCTION "public"."enforce_beta_approval_senior_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  actor_role text;
begin
  if (new.beta_status is distinct from old.beta_status)
     or (new.beta_user is distinct from old.beta_user) then
    if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
      return new;
    end if;

    if auth.uid() is null then
      raise exception 'Unauthorized beta approval update.';
    end if;

    select p.role into actor_role
    from public.profiles p
    where p.id = auth.uid()
    limit 1;

    if coalesce(lower(actor_role), '') <> 'senior_admin' then
      raise exception 'Only senior_admin can approve or reject beta users.';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_beta_approval_senior_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founding_tester_approve_beta"("p_target" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.profiles
  set beta_user = true,
      beta_status = 'approved',
      founding_tester = true
  where id = p_target;
end;
$$;


ALTER FUNCTION "public"."founding_tester_approve_beta"("p_target" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "account_balance" integer DEFAULT 0,
    "site_credits" integer DEFAULT 0,
    "loyalty_points" integer DEFAULT 0,
    "loyalty_tier" "text" DEFAULT 'Bronze'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "email" "text",
    "username" "text" NOT NULL,
    "wallet_balance" numeric GENERATED ALWAYS AS ("account_balance") STORED NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "beta_user" boolean DEFAULT false,
    "beta_status" "text" DEFAULT 'pending'::"text",
    "founding_tester" boolean DEFAULT false,
    "beta_notes" "text",
    "protection_credit_balance" integer DEFAULT 0,
    "admin_user" boolean DEFAULT false,
    "protection_credits" numeric DEFAULT 0,
    "role" "text" DEFAULT 'user'::"text",
    "avatar_url" "text",
    "welcome_email_sent" boolean DEFAULT false NOT NULL,
    CONSTRAINT "beta_status_check" CHECK (("beta_status" = ANY (ARRAY['approved'::"text", 'pending'::"text"]))),
    CONSTRAINT "profiles_account_balance_non_negative" CHECK (("account_balance" >= 0)),
    CONSTRAINT "profiles_username_format" CHECK (("username" ~ '^[a-z0-9_]{3,20}$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profile: wallet balances, loyalty points, tier. id matches auth.users.id.';



COMMENT ON COLUMN "public"."profiles"."email" IS 'Mirror of auth.users.email for joins; keep in sync on signup/profile updates.';



COMMENT ON COLUMN "public"."profiles"."username" IS 'Unique DFS handle (lowercase a-z 0-9 _). Temp default user_<6hex> until user sets a custom name.';



COMMENT ON COLUMN "public"."profiles"."wallet_balance" IS 'Same as account_balance; spendable wallet for contest entry.';



COMMENT ON COLUMN "public"."profiles"."updated_at" IS 'Last update to profile row (wallet, tier, etc.).';



COMMENT ON COLUMN "public"."profiles"."avatar_url" IS 'Public URL for profile image (Supabase Storage avatars bucket).';



COMMENT ON COLUMN "public"."profiles"."welcome_email_sent" IS 'Set true after the post-confirmation welcome email is sent successfully.';



COMMENT ON CONSTRAINT "profiles_account_balance_non_negative" ON "public"."profiles" IS 'Spendable balance cannot go negative; contest entry and other debits must check before update.';



CREATE OR REPLACE FUNCTION "public"."founding_tester_list_beta_profiles"() RETURNS SETOF "public"."profiles"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select *
  from public.profiles
  order by created_at desc;
$$;


ALTER FUNCTION "public"."founding_tester_list_beta_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_temp_profile_username"("p_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
declare
  hex_full text := lower(replace(p_id::text, '-', ''));
  base text := 'user_' || substr(hex_full, 1, 6);
  cand text := base;
  n int := 1;
begin
  while exists (
    select 1
    from public.profiles p
    where lower(p.username) = lower(cand)
      and p.id is distinct from p_id
  ) loop
    n := n + 1;
    cand := left(base, 16) || n::text;
    if length(cand) > 20 then
      cand := 'user_' || left(hex_full, 15);
    end if;
    exit when n > 500;
  end loop;
  return cand;
end;
$$;


ALTER FUNCTION "public"."generate_temp_profile_username"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.lineups l
    where l.id = p_lineup_id
      and (
        l.locked_at is not null
        or (
          l.contest_id is not null
          and exists (
            select 1
            from public.contests c
            where c.id::text = l.contest_id::text
              and now() >= c.starts_at
          )
        )
      )
  );
$$;


ALTER FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") IS 'True when lineups.locked_at is set or the lineup contest has reached starts_at.';



CREATE OR REPLACE FUNCTION "public"."loyalty_tier_from_points"("p_points" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case
    when p_points >= 10000 then 'Platinum'
    when p_points >= 2500 then 'Gold'
    when p_points >= 500 then 'Silver'
    else 'Bronze'
  end;
$$;


ALTER FUNCTION "public"."loyalty_tier_from_points"("p_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cid text;
  v_contest record;
  v_wd_on boolean;
  v_wd_pct numeric;
  v_mc_on boolean;
  v_mc_pct numeric;
  v_ov_on boolean;
  v_ov_guaranteed numeric;
  v_eligible_after timestamptz;
  ce record;
  v_wd_amt numeric;
  v_mc_amt numeric;
  v_paid numeric;
  v_cap numeric;
  v_ef numeric;
  v_total_out numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_one jsonb;
  v_actual_pool numeric;
  v_guaranteed numeric;
  v_shortfall numeric;
  v_n int;
  v_each numeric;
  v_extra numeric;
  v_i int;
  v_share numeric;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  select * into v_contest from public.contests c where c.id = v_cid for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if exists (select 1 from public.contest_insurance_runs r where r.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'Contest insurance already processed.');
  end if;

  -- After scoring window: at least 1 day post lock (set golfer_scores / withdrawn flags first).
  v_eligible_after := v_contest.starts_at + interval '1 day';
  if now() < v_eligible_after then
    return jsonb_build_object(
      'ok', false,
      'error',
      'Insurance processing opens 24 hours after contest start (after scoring).'
    );
  end if;

  select
    coalesce(ci.wd_protection_enabled, false),
    coalesce(ci.wd_refund_pct, 0::numeric),
    coalesce(ci.missed_cut_insurance_enabled, false),
    coalesce(ci.missed_cut_refund_pct, 0::numeric),
    coalesce(ci.overlay_insurance_enabled, false),
    ci.overlay_guaranteed_prize_pool_usd
  into v_wd_on, v_wd_pct, v_mc_on, v_mc_pct, v_ov_on, v_ov_guaranteed
  from public.contest_insurance ci
  where ci.contest_id = v_cid;

  if not found then
    v_wd_on := false;
    v_wd_pct := 0;
    v_mc_on := false;
    v_mc_pct := 0;
    v_ov_on := false;
    v_ov_guaranteed := null;
  end if;

  select count(*)::int into v_n from public.contest_entries ce where ce.contest_id = v_cid;
  if v_n < 1 then
    return jsonb_build_object('ok', false, 'error', 'No contest entries.');
  end if;

  -- Per-entry: WD + missed cut (capped by entry_fee), only when CashCaddie protection was purchased.
  for ce in
    select *
    from public.contest_entries ce
    where ce.contest_id = v_cid
  loop
    v_wd_amt := 0;
    v_mc_amt := 0;
    v_ef := round(greatest(coalesce(ce.entry_fee, 0), 0)::numeric, 2);

    if coalesce(ce.protection_enabled, false) and ce.lineup_id is not null then
      if v_wd_on and v_wd_pct > 0 and v_ef > 0 then
        if exists (
          select 1
          from public.lineup_players lp
          inner join public.golfers g on g.id = lp.golfer_id
          where lp.lineup_id = ce.lineup_id
            and lp.is_protected
            and coalesce(g.withdrawn, false)
        ) then
          v_wd_amt := round(v_ef * v_wd_pct / 100.0, 2);
        end if;
      end if;

      if v_mc_on and v_mc_pct > 0 and v_ef > 0 then
        if exists (
          select 1
          from public.lineup_players lp
          inner join public.golfers g on g.id = lp.golfer_id
          left join public.golfer_scores gs
            on gs.golfer_id = lp.golfer_id
            and gs.contest_id = v_cid
          where lp.lineup_id = ce.lineup_id
            and lp.is_protected
            and not coalesce(g.withdrawn, false)
            and coalesce(gs.missed_cut, false)
        ) then
          v_mc_amt := round(v_ef * v_mc_pct / 100.0, 2);
        end if;
      end if;
    end if;

    v_cap := v_ef;
    v_paid := 0;

    if v_wd_amt > 0 then
      v_paid := least(v_wd_amt, v_cap);
      if v_paid > 0 then
        insert into public.profiles (id)
        values (ce.user_id)
        on conflict (id) do nothing;

        update public.profiles p
        set
          account_balance = round(coalesce(p.account_balance, 0)::numeric + v_paid, 2),
          updated_at = now()
        where p.id = ce.user_id;

        insert into public.transactions (user_id, amount, type, description)
        values (
          ce.user_id,
          v_paid,
          'contest_insurance_payout',
          format(
            'Insurance — WD protection — %s (%s)',
            coalesce(nullif(trim(v_contest.name), ''), v_cid),
            v_cid
          )
        );

        v_total_out := round(v_total_out + v_paid, 2);
        v_one := jsonb_build_object(
          'kind', 'wd_protection',
          'contest_entry_id', ce.id,
          'user_id', ce.user_id,
          'amount_usd', v_paid
        );
        v_breakdown := v_breakdown || jsonb_build_array(v_one);
      end if;
    end if;

    if v_mc_amt > 0 and v_cap > v_paid then
      v_mc_amt := least(v_mc_amt, round(v_cap - v_paid, 2));
      if v_mc_amt > 0 then
        insert into public.profiles (id)
        values (ce.user_id)
        on conflict (id) do nothing;

        update public.profiles p
        set
          account_balance = round(coalesce(p.account_balance, 0)::numeric + v_mc_amt, 2),
          updated_at = now()
        where p.id = ce.user_id;

        insert into public.transactions (user_id, amount, type, description)
        values (
          ce.user_id,
          v_mc_amt,
          'contest_insurance_payout',
          format(
            'Insurance — missed cut — %s (%s)',
            coalesce(nullif(trim(v_contest.name), ''), v_cid),
            v_cid
          )
        );

        v_total_out := round(v_total_out + v_mc_amt, 2);
        v_one := jsonb_build_object(
          'kind', 'missed_cut',
          'contest_entry_id', ce.id,
          'user_id', ce.user_id,
          'amount_usd', v_mc_amt
        );
        v_breakdown := v_breakdown || jsonb_build_array(v_one);
      end if;
    end if;
  end loop;

  -- Overlay: credit each entrant equally if actual entry-fee pool falls short of guarantee.
  if v_ov_on and v_ov_guaranteed is not null and v_ov_guaranteed > 0 then
    select coalesce(sum(round(greatest(coalesce(ce.entry_fee, 0), 0)::numeric, 2)), 0)
    into v_actual_pool
    from public.contest_entries ce
    where ce.contest_id = v_cid;

    v_guaranteed := round(v_ov_guaranteed, 2);
    if v_actual_pool < v_guaranteed then
      v_shortfall := round(v_guaranteed - v_actual_pool, 2);
      if v_shortfall > 0 and v_n > 0 then
        v_each := round(v_shortfall / v_n::numeric, 2);
        v_extra := round(v_shortfall - (v_each * v_n::numeric), 2);
        v_i := 0;

        for ce in
          select *
          from public.contest_entries ce
          where ce.contest_id = v_cid
          order by ce.created_at asc, ce.id asc
        loop
          v_i := v_i + 1;
          v_share := v_each;
          if v_i = 1 then
            v_share := round(v_share + v_extra, 2);
          end if;

          if v_share > 0 then
            insert into public.profiles (id)
            values (ce.user_id)
            on conflict (id) do nothing;

            update public.profiles p
            set
              account_balance = round(coalesce(p.account_balance, 0)::numeric + v_share, 2),
              updated_at = now()
            where p.id = ce.user_id;

            insert into public.transactions (user_id, amount, type, description)
            values (
              ce.user_id,
              v_share,
              'contest_insurance_payout',
              format(
                'Insurance — overlay — %s (%s)',
                coalesce(nullif(trim(v_contest.name), ''), v_cid),
                v_cid
              )
            );

            v_total_out := round(v_total_out + v_share, 2);
            v_one := jsonb_build_object(
              'kind', 'overlay',
              'contest_entry_id', ce.id,
              'user_id', ce.user_id,
              'amount_usd', v_share
            );
            v_breakdown := v_breakdown || jsonb_build_array(v_one);
          end if;
        end loop;
      end if;
    end if;
  end if;

  insert into public.contest_insurance_runs (contest_id, total_credited_usd)
  values (v_cid, v_total_out);

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'total_credited_usd', v_total_out,
    'lines', v_breakdown
  );
exception
  when others then
    raise;
end;
$$;


ALTER FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") IS 'After scoring: WD refunds (protected + withdrawn), missed-cut partial refunds, overlay pool shortfall split; idempotent.';



CREATE OR REPLACE FUNCTION "public"."profiles_username_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
begin
  if new.username is null or btrim(new.username::text) = '' then
    new.username := public.generate_temp_profile_username(new.id);
  else
    new.username := lower(btrim(new.username::text));
  end if;

  if new.username is null or new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'profiles.username must be 3–20 characters: lowercase letters, digits, underscore only';
  end if;

  return new;
end;
$_$;


ALTER FUNCTION "public"."profiles_username_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."profiles_username_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
begin
  new.username := lower(btrim(coalesce(new.username, old.username)::text));

  if new.username is null or new.username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'profiles.username must be 3–20 characters: lowercase letters, digits, underscore only';
  end if;

  return new;
end;
$_$;


ALTER FUNCTION "public"."profiles_username_before_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(coalesce(gs.total_score, g.fantasy_points, 0))::numeric
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


ALTER FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") IS 'Recompute lineups.total_score for contest entries in p_contest_id from golfer_scores.';



CREATE OR REPLACE FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  update public.lineups l
  set total_score = coalesce((
    select sum(
      case
        when l.contest_id is not null then coalesce(gs.total_score, g.fantasy_points, 0)::numeric
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


ALTER FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() IS 'Sets lineups.total_score: for contest lineups, sum golfer_scores.total_score (else golfers.fantasy_points); drafts sum fantasy_points only.';



CREATE OR REPLACE FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cid text;
  v_contest record;
  v_entry_count int;
  v_prize_pool numeric;
  v_settles_after timestamptz;
  v_winners uuid[];
  v_len int;
  r_payout record;
  v_user_id uuid;
  v_amt numeric;
  v_total_out numeric := 0;
  v_payouts jsonb := '[]'::jsonb;
  v_one jsonb;
  v_cur_bal numeric;
begin
  v_cid := nullif(trim(p_contest_id), '');
  if v_cid is null then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  select * into v_contest from public.contests c where c.id = v_cid for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Contest not found.');
  end if;

  if exists (select 1 from public.contest_settlements s where s.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'Contest already settled.');
  end if;

  v_settles_after := v_contest.starts_at + interval '3 days';
  if now() < v_settles_after then
    return jsonb_build_object(
      'ok', false,
      'error',
      'Contest is not eligible for settlement yet. Settlement opens 3 days after contest start.'
    );
  end if;

  select count(*)::int into v_entry_count from public.contest_entries ce where ce.contest_id = v_cid;
  if v_entry_count < 1 then
    return jsonb_build_object('ok', false, 'error', 'No entries to settle.');
  end if;

  v_prize_pool := round(v_contest.entry_fee_usd * v_entry_count, 2);
  if v_prize_pool <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Prize pool is zero; nothing to distribute.');
  end if;

  if not exists (select 1 from public.contest_payouts pp where pp.contest_id = v_cid) then
    return jsonb_build_object('ok', false, 'error', 'No payout structure for this contest (contest_payouts).');
  end if;

  select array_agg(user_id order by ord) into v_winners
  from (
    select
      ce.user_id,
      row_number() over (
        order by coalesce(l.total_score, 0) desc nulls last, ce.id
      ) as ord
    from public.contest_entries ce
    left join public.lineups l on l.id = ce.lineup_id
    where ce.contest_id = v_cid
  ) ranked;

  if v_winners is null or array_length(v_winners, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Could not build leaderboard.');
  end if;

  v_len := array_length(v_winners, 1);

  for r_payout in
    select pp.rank_place, pp.payout_pct
    from public.contest_payouts pp
    where pp.contest_id = v_cid
    order by pp.rank_place
  loop
    if r_payout.rank_place < 1 or r_payout.rank_place > v_len then
      continue;
    end if;

    v_user_id := v_winners[r_payout.rank_place];
    v_amt := round(v_prize_pool * r_payout.payout_pct / 100.0, 2);

    if v_amt <= 0 then
      continue;
    end if;

    insert into public.profiles (id)
    values (v_user_id)
    on conflict (id) do nothing;

    select coalesce(p.account_balance, 0) into v_cur_bal
    from public.profiles p
    where p.id = v_user_id;

    if round(v_cur_bal::numeric + v_amt, 2) > 5000::numeric then
      return jsonb_build_object('ok', false, 'error', 'Wallet limit exceeded – contact admin');
    end if;

    update public.profiles p
    set
      account_balance = round(coalesce(p.account_balance, 0)::numeric + v_amt, 2),
      updated_at = now()
    where p.id = v_user_id;

    insert into public.transactions (user_id, amount, type, description)
    values (
      v_user_id,
      v_amt,
      'contest_prize',
      format(
        'Contest prize — %s (place %s)',
        coalesce(nullif(trim(v_contest.name), ''), v_cid),
        r_payout.rank_place
      )
    );

    v_total_out := round(v_total_out + v_amt, 2);

    v_one := jsonb_build_object(
      'user_id', v_user_id,
      'rank_place', r_payout.rank_place,
      'amount_usd', v_amt,
      'payout_pct', r_payout.payout_pct
    );
    v_payouts := v_payouts || jsonb_build_array(v_one);
  end loop;

  insert into public.contest_settlements (contest_id, prize_pool_usd, entry_count, distributed_usd)
  values (v_cid, v_prize_pool, v_entry_count, v_total_out);

  return jsonb_build_object(
    'ok', true,
    'contest_id', v_cid,
    'prize_pool_usd', v_prize_pool,
    'entry_count', v_entry_count,
    'distributed_usd', v_total_out,
    'payouts', v_payouts
  );
exception
  when others then
    raise;
end;
$$;


ALTER FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") IS 'Sort leaderboard by lineup total_score, apply contest_payouts, credit account_balance and transactions (idempotent per contest). Rejects settlement if any prize would exceed beta wallet cap (5000 USD).';



CREATE OR REPLACE FUNCTION "public"."simulate_all_lineup_scores"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.golfer_scores (
    golfer_id,
    contest_id,
    birdies,
    pars,
    bogeys,
    double_bogeys,
    eagles,
    albatrosses
  )
  select distinct
    lp.golfer_id,
    l.contest_id,
    (2 + floor(random() * 5))::integer,
    (8 + floor(random() * 7))::integer,
    floor(random() * 5)::integer,
    floor(random() * 3)::integer,
    floor(random() * 3)::integer,
    (case when random() < 0.07 then 1 else 0 end)::integer
  from public.lineup_players lp
  inner join public.lineups l on l.id = lp.lineup_id
  where l.contest_id is not null
  on conflict (golfer_id, contest_id) do update set
    birdies = excluded.birdies,
    pars = excluded.pars,
    bogeys = excluded.bogeys,
    double_bogeys = excluded.double_bogeys,
    eagles = excluded.eagles,
    albatrosses = excluded.albatrosses;

  return public.refresh_lineup_total_scores_from_golfers();
end;
$$;


ALTER FUNCTION "public"."simulate_all_lineup_scores"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."simulate_all_lineup_scores"() IS 'DFS simulate: golfer_scores for all (golfer, contest) on lineups with contest_id; full refresh of lineups.total_score; returns lineup count.';



CREATE OR REPLACE FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  n int;
begin
  insert into public.golfer_scores (
    golfer_id,
    contest_id,
    birdies,
    pars,
    bogeys,
    double_bogeys,
    eagles,
    albatrosses
  )
  select distinct
    lp.golfer_id,
    l.contest_id,
    (2 + floor(random() * 5))::integer,
    (8 + floor(random() * 7))::integer,
    floor(random() * 5)::integer,
    floor(random() * 3)::integer,
    floor(random() * 3)::integer,
    (case when random() < 0.07 then 1 else 0 end)::integer
  from public.lineup_players lp
  inner join public.lineups l on l.id = lp.lineup_id
  inner join public.contest_entries ce
    on ce.contest_id = l.contest_id
    and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
  where l.contest_id::text = p_contest_id
  on conflict (golfer_id, contest_id) do update set
    birdies = excluded.birdies,
    pars = excluded.pars,
    bogeys = excluded.bogeys,
    double_bogeys = excluded.double_bogeys,
    eagles = excluded.eagles,
    albatrosses = excluded.albatrosses;

  perform public.refresh_lineup_total_scores_for_contest(p_contest_id);

  with updated as (
    select l.id
    from public.lineups l
    where l.contest_id::text = p_contest_id
      and exists (
        select 1
        from public.contest_entries ce
        where ce.contest_id::text = p_contest_id
          and (l.id = ce.lineup_id or (ce.lineup_id is null and l.contest_entry_id = ce.id))
      )
  )
  select count(*)::int into n from updated;

  return coalesce(n, 0);
end;
$$;


ALTER FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") IS 'DFS simulate: upsert golfer_scores with realistic counts, refresh lineups.total_score for contest; returns row count of entered lineups.';



CREATE OR REPLACE FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
begin

update lineups l
set total_score = round((random()*120 + 180)::numeric,1)

from contest_entries ce

where ce.lineup_id = l.id
and ce.contest_id = p_contest_id
and l.id = ce.lineup_id;

end;
$$;


ALTER FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_contest_entry_count"("p_contest_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
begin
  if p_contest_id is null or btrim(p_contest_id) = '' then
    return;
  end if;

  select count(*)::integer
  into v_count
  from public.contest_entries ce
  where ce.contest_id = p_contest_id;

  update public.contests
  set entry_count = v_count
  where id = p_contest_id;
end;
$$;


ALTER FUNCTION "public"."sync_contest_entry_count"("p_contest_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_contest_entries_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; entries are closed.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if public.contest_is_past_start(old.contest_id::text) then
      raise exception 'Contest has started; contest entry cannot be modified.';
    end if;
    return new;
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_enforce_contest_entries_lock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_contest_entry_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cap integer;
  per_user integer;
  n_total bigint;
  n_user bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  -- Row lock: all inserts for this contest queue here; count reflects committed rows only.
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
    raise exception 'Max entries per user for this contest.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_enforce_contest_entry_capacity"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trg_enforce_contest_entry_capacity"() IS 'Before insert: lock contest row, reject when count(contest_entries) >= max_entries (same transaction as insert).';



CREATE OR REPLACE FUNCTION "public"."trg_enforce_lineup_players_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  lid uuid;
begin
  lid := coalesce(new.lineup_id, old.lineup_id);
  if lid is null then
    return coalesce(new, old);
  end if;
  if public.lineup_roster_locked(lid) then
    raise exception 'Contest has started; lineup roster is locked.';
  end if;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_enforce_lineup_players_lock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_enforce_lineups_contest_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_cid text;
  v_starts timestamptz;
  v_started boolean;
begin
  if tg_op = 'INSERT' then
    new.locked_at := null;
    if new.contest_id is not null and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot create a lineup for this contest.';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    v_cid := coalesce(new.contest_id, old.contest_id)::text;
    v_started := v_cid is not null and public.contest_is_past_start(v_cid);

    if new.contest_id is not null
       and old.contest_id is distinct from new.contest_id
       and public.contest_is_past_start(new.contest_id::text) then
      raise exception 'Contest has started; cannot assign this contest to the lineup.';
    end if;

    select c.starts_at into v_starts
    from public.contests c
    where c.id::text = v_cid
    limit 1;

    if old.locked_at is not null then
      new.locked_at := old.locked_at;
    elsif v_started and v_starts is not null then
      new.locked_at := v_starts;
    else
      new.locked_at := null;
    end if;

    if public.lineup_roster_locked(old.id) then
      if (old.user_id is distinct from new.user_id)
         or (old.contest_id is distinct from new.contest_id)
         or (old.total_salary is distinct from new.total_salary)
         or (old.created_at is distinct from new.created_at)
         or (old.entry_fee is distinct from new.entry_fee)
         or (old.protection_fee is distinct from new.protection_fee)
         or (old.total_paid is distinct from new.total_paid)
         or (old.protection_enabled is distinct from new.protection_enabled)
         or (old.contest_entry_id is distinct from new.contest_entry_id)
      then
        raise exception 'Contest has started; lineup is locked.';
      end if;
    end if;
    return new;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_enforce_lineups_contest_lock"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "admin_display" "text",
    "target" "text",
    "details" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_logs" IS 'Append-only admin audit log: action label, acting admin, optional target description.';



COMMENT ON COLUMN "public"."admin_logs"."admin_display" IS 'Optional display label for the admin (e.g. @handle or email) for UI without joining profiles.';



COMMENT ON COLUMN "public"."admin_logs"."details" IS 'Optional reason or extra context for the admin action.';



CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_config" IS 'Application key/value flags (e.g. allow_test_wallet_funding). Not exposed to PostgREST clients when RLS has no policies.';



CREATE TABLE IF NOT EXISTS "public"."beta_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "confusion_point" "text",
    "feature_request" "text",
    "bug_report" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "beta_feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."beta_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."beta_feedback" IS 'Private beta product feedback; one row per submit from authenticated users.';



CREATE TABLE IF NOT EXISTS "public"."contest_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "contest_id" "uuid",
    "lineup_id" "uuid",
    "entry_fee" integer,
    "protection_fee" integer DEFAULT 0,
    "total_paid" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "protection_enabled" boolean DEFAULT false,
    "status" "text" DEFAULT 'entered'::"text",
    "entry_number" integer DEFAULT 1 NOT NULL,
    "safety_coverage_fee" numeric(10,2),
    "entry_fee_total" numeric(10,2),
    "prize_contribution" numeric(10,2),
    "platform_fee" numeric(10,2),
    "insured_golfer_id" "uuid" NOT NULL
);


ALTER TABLE "public"."contest_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."contest_entries" IS 'Contest entry ledger row created when user enters; fees match transactions + lineup.';



COMMENT ON COLUMN "public"."contest_entries"."lineup_id" IS 'Roster this entry pays for; set when entering with a saved lineup or after lineup insert.';



COMMENT ON COLUMN "public"."contest_entries"."total_paid" IS 'entry_fee + protection_fee; deducted from site_credits then account_balance.';



COMMENT ON COLUMN "public"."contest_entries"."entry_number" IS '1-based index of this user''s entries in the contest (leaderboard ordering uses separate logic).';



CREATE TABLE IF NOT EXISTS "public"."contest_insurance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contest_id" "uuid",
    "insurance_enabled" boolean DEFAULT false,
    "insurance_cost" integer DEFAULT 0,
    "max_claims" integer DEFAULT 1,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "wd_protection_enabled" boolean DEFAULT false NOT NULL,
    "wd_refund_pct" numeric DEFAULT 100 NOT NULL,
    "missed_cut_insurance_enabled" boolean DEFAULT false NOT NULL,
    "missed_cut_refund_pct" numeric DEFAULT 50 NOT NULL,
    "overlay_insurance_enabled" boolean DEFAULT false NOT NULL,
    "overlay_guaranteed_prize_pool_usd" numeric,
    CONSTRAINT "contest_insurance_missed_cut_refund_pct_check" CHECK ((("missed_cut_refund_pct" >= (0)::numeric) AND ("missed_cut_refund_pct" <= (100)::numeric))),
    CONSTRAINT "contest_insurance_overlay_guaranteed_nonneg" CHECK ((("overlay_guaranteed_prize_pool_usd" IS NULL) OR ("overlay_guaranteed_prize_pool_usd" >= (0)::numeric))),
    CONSTRAINT "contest_insurance_wd_refund_pct_check" CHECK ((("wd_refund_pct" >= (0)::numeric) AND ("wd_refund_pct" <= (100)::numeric)))
);


ALTER TABLE "public"."contest_insurance" OWNER TO "postgres";


COMMENT ON TABLE "public"."contest_insurance" IS 'Per-contest insurance products: WD protection, missed cut, overlay (see column comments).';



COMMENT ON COLUMN "public"."contest_insurance"."insurance_cost" IS 'Cost in the same currency unit as entry fees (e.g. dollars).';



COMMENT ON COLUMN "public"."contest_insurance"."wd_protection_enabled" IS 'Refund entry-fee portion when a protected golfer withdraws (golfers.withdrawn).';



COMMENT ON COLUMN "public"."contest_insurance"."missed_cut_insurance_enabled" IS 'Partial entry-fee refund when a protected golfer missed the cut (golfer_scores.missed_cut).';



COMMENT ON COLUMN "public"."contest_insurance"."overlay_insurance_enabled" IS 'If sum(entry_fee) < overlay_guaranteed_prize_pool_usd, credit each entrant their share of the shortfall.';



CREATE TABLE IF NOT EXISTS "public"."contest_insurance_runs" (
    "contest_id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_credited_usd" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "contest_insurance_runs_total_credited_usd_check" CHECK (("total_credited_usd" >= (0)::numeric))
);


ALTER TABLE "public"."contest_insurance_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."contest_insurance_runs" IS 'One row per contest after automatic insurance payouts; prevents double processing.';



CREATE TABLE IF NOT EXISTS "public"."contest_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contest_id" "text" NOT NULL,
    "rank_place" integer NOT NULL,
    "payout_pct" numeric NOT NULL,
    CONSTRAINT "contest_payouts_payout_pct_check" CHECK ((("payout_pct" >= (0)::numeric) AND ("payout_pct" <= (100)::numeric))),
    CONSTRAINT "contest_payouts_rank_place_check" CHECK ((("rank_place" >= 1) AND ("rank_place" <= 100)))
);


ALTER TABLE "public"."contest_payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contest_payouts" IS 'Leaderboard prize share by finishing place (% of prize_pool).';



CREATE TABLE IF NOT EXISTS "public"."contest_settlements" (
    "contest_id" "text" NOT NULL,
    "settled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prize_pool_usd" numeric NOT NULL,
    "entry_count" integer NOT NULL,
    "distributed_usd" numeric NOT NULL,
    CONSTRAINT "contest_settlements_distributed_usd_check" CHECK (("distributed_usd" >= (0)::numeric)),
    CONSTRAINT "contest_settlements_entry_count_check" CHECK (("entry_count" >= 1)),
    CONSTRAINT "contest_settlements_prize_pool_usd_check" CHECK (("prize_pool_usd" >= (0)::numeric))
);


ALTER TABLE "public"."contest_settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."contest_settlements" IS 'One row per contest after prizes are distributed; prevents double settlement.';



CREATE TABLE IF NOT EXISTS "public"."contests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "entry_fee" integer DEFAULT 0,
    "max_entries" integer DEFAULT 100,
    "prize_pool" integer DEFAULT 0,
    "start_date" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "entry_fee_usd" integer DEFAULT 0,
    "starts_at" timestamp without time zone,
    "max_entries_per_user" integer DEFAULT 1,
    "start_time" timestamp with time zone,
    "lineup_locked" boolean DEFAULT false,
    "status" "text" DEFAULT 'open'::"text",
    "ends_at" timestamp with time zone,
    "protected_entries_count" integer DEFAULT 0,
    "protection_fund_contribution" numeric DEFAULT 0,
    "created_by" "uuid",
    "entry_count" integer DEFAULT 0,
    "contest_status" "text" DEFAULT 'open'::"text",
    "entries_open_at" timestamp with time zone,
    CONSTRAINT "contest_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'locked'::"text", 'live'::"text", 'completed'::"text", 'cancelled'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."contests" OWNER TO "postgres";


COMMENT ON TABLE "public"."contests" IS 'DFS contest definitions; lineup rows reference id via lineups.contest_id.';



COMMENT ON COLUMN "public"."contests"."starts_at" IS 'Authoritative contest start (lock) time; entry and roster edits allowed only while now() < starts_at.';



COMMENT ON COLUMN "public"."contests"."max_entries_per_user" IS 'Max lineup entries per user for this contest.';



COMMENT ON COLUMN "public"."contests"."start_time" IS 'DFS contest start / lock time (mirrors starts_at).';



COMMENT ON COLUMN "public"."contests"."ends_at" IS 'When set, contest is completed after this instant. When null, app treats "ended" as starts_at + 3 days (scoring window).';



CREATE OR REPLACE VIEW "public"."contests_with_stats" WITH ("security_invoker"='false') AS
 SELECT "id",
    "name",
    "entry_fee_usd",
    "max_entries",
    "max_entries_per_user",
    "starts_at",
    "start_time",
    "ends_at",
    ("now"() >= "starts_at") AS "lineup_locked",
    "created_at",
    ("public"."contest_entry_count"(("id")::"text"))::integer AS "current_entries",
    "round"((("entry_fee_usd")::numeric * ("public"."contest_entry_count"(("id")::"text"))::numeric), 2) AS "prize_pool"
   FROM "public"."contests" "c";


ALTER VIEW "public"."contests_with_stats" OWNER TO "postgres";


COMMENT ON VIEW "public"."contests_with_stats" IS 'Lobby catalog + entry-derived stats; security_invoker=false so anon can select the view without direct contests table grant.';



CREATE TABLE IF NOT EXISTS "public"."founder_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."founder_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."golfer_scores" (
    "golfer_id" "uuid" NOT NULL,
    "contest_id" "text" NOT NULL,
    "birdies" integer DEFAULT 0 NOT NULL,
    "pars" integer DEFAULT 0 NOT NULL,
    "bogeys" integer DEFAULT 0 NOT NULL,
    "double_bogeys" integer DEFAULT 0 NOT NULL,
    "eagles" integer DEFAULT 0 NOT NULL,
    "albatrosses" integer DEFAULT 0 NOT NULL,
    "total_score" numeric GENERATED ALWAYS AS ("round"((((((((3)::numeric * ("birdies")::numeric) + (0.5 * ("pars")::numeric)) + ((- (1)::numeric) * ("bogeys")::numeric)) + ((- (3)::numeric) * ("double_bogeys")::numeric)) + ((8)::numeric * ("eagles")::numeric)) + ((13)::numeric * ("albatrosses")::numeric)), 2)) STORED NOT NULL,
    "missed_cut" boolean DEFAULT false NOT NULL,
    CONSTRAINT "golfer_scores_albatrosses_check" CHECK (("albatrosses" >= 0)),
    CONSTRAINT "golfer_scores_birdies_check" CHECK (("birdies" >= 0)),
    CONSTRAINT "golfer_scores_bogeys_check" CHECK (("bogeys" >= 0)),
    CONSTRAINT "golfer_scores_double_bogeys_check" CHECK (("double_bogeys" >= 0)),
    CONSTRAINT "golfer_scores_eagles_check" CHECK (("eagles" >= 0)),
    CONSTRAINT "golfer_scores_pars_check" CHECK (("pars" >= 0))
);


ALTER TABLE "public"."golfer_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."golfer_scores" IS 'Per-golfer fantasy stats for a contest; total_score is derived from hole-outcome counts.';



COMMENT ON COLUMN "public"."golfer_scores"."missed_cut" IS 'After scoring: true if golfer missed the cut; used for missed-cut insurance (not withdrawn).';



CREATE TABLE IF NOT EXISTS "public"."golfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "salary" integer,
    "pga_id" "text",
    "image_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "withdrawn" boolean DEFAULT false,
    "fantasy_points" integer DEFAULT 0,
    "made_cut" boolean DEFAULT true,
    "position" integer DEFAULT 0
);


ALTER TABLE "public"."golfers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."golfers"."withdrawn" IS 'WD before lock — triggers protection claim eligibility when lineup has protection.';



COMMENT ON COLUMN "public"."golfers"."fantasy_points" IS 'Cumulative fantasy points from simple B/P/Bg scoring; summed per lineup for leaderboards.';



CREATE TABLE IF NOT EXISTS "public"."insurance_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lineup_id" "uuid",
    "golfer_id" "uuid",
    "claim_type" "text",
    "status" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "refund_amount_usd" numeric,
    CONSTRAINT "insurance_claims_claim_type_check" CHECK (("claim_type" = ANY (ARRAY['swap'::"text", 'refund_credit'::"text", 'refund_balance'::"text"]))),
    CONSTRAINT "insurance_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."insurance_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."insurance_claims" IS 'User-submitted insurance claims tied to a lineup and golfer (validate golfer is in lineup in app).';



COMMENT ON COLUMN "public"."insurance_claims"."refund_amount_usd" IS 'Entry fee refunded or credited when claim is approved (null for pending swap / manual review).';



CREATE TABLE IF NOT EXISTS "public"."insurance_pool" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "total_balance" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "insurance_pool_total_balance_nonneg" CHECK (("total_balance" >= (0)::numeric))
);


ALTER TABLE "public"."insurance_pool" OWNER TO "postgres";


COMMENT ON TABLE "public"."insurance_pool" IS 'Singleton-style fund balance for Safety Coverage; balance changes via insurance engine when fully migrated.';



COMMENT ON COLUMN "public"."insurance_pool"."total_balance" IS 'Running balance of the player-protection pool.';



CREATE TABLE IF NOT EXISTS "public"."lineup_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lineup_id" "uuid" NOT NULL,
    "golfer_id" "uuid",
    "is_protected" boolean DEFAULT false,
    "golfer_score" integer DEFAULT 0,
    "protection_ui_status" "text" DEFAULT 'none'::"text",
    "protection_credit_issued" boolean DEFAULT false,
    "protection_reason" "text",
    "swap_available_until" timestamp with time zone,
    "protected_score" integer DEFAULT 0
);


ALTER TABLE "public"."lineup_players" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lineup_players"."is_protected" IS 'CashCaddie Protection covers this golfer; tier caps how many may be true per lineup.';



CREATE TABLE IF NOT EXISTS "public"."lineups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contest_id" "text",
    "total_salary" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "entry_fee" numeric DEFAULT 0 NOT NULL,
    "protection_fee" numeric DEFAULT 0 NOT NULL,
    "total_paid" numeric DEFAULT 0 NOT NULL,
    "protection_enabled" boolean DEFAULT false NOT NULL,
    "contest_entry_id" "uuid",
    "total_score" numeric DEFAULT 0,
    "locked_at" timestamp with time zone
);


ALTER TABLE "public"."lineups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lineups"."contest_id" IS 'Lobby contest id (matches public.contests.id when set). Null when saved without a contest.';



COMMENT ON COLUMN "public"."lineups"."entry_fee" IS 'Contest entry fee in USD at time of entry.';



COMMENT ON COLUMN "public"."lineups"."protection_fee" IS 'CashCaddie Protection add-on in USD (0 if disabled).';



COMMENT ON COLUMN "public"."lineups"."total_paid" IS 'entry_fee + protection_fee';



COMMENT ON COLUMN "public"."lineups"."protection_enabled" IS 'Whether CashCaddie Protection was purchased.';



COMMENT ON COLUMN "public"."lineups"."contest_entry_id" IS 'Links lineup to the contest_entries payment row.';



COMMENT ON COLUMN "public"."lineups"."total_score" IS 'Aggregate fantasy score for this lineup (denormalized).';



COMMENT ON COLUMN "public"."lineups"."locked_at" IS 'Set to contests.starts_at when the contest has started; roster and lineup row metadata cannot change after this (total_score may still update).';



CREATE TABLE IF NOT EXISTS "public"."loyalty_tiers" (
    "tier_name" "text" NOT NULL,
    "min_points" integer,
    "protection_discount" integer,
    "max_protected_golfers" integer,
    "bonus_points_multiplier" numeric
);


ALTER TABLE "public"."loyalty_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protection_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text",
    "amount" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "protection_amount" integer DEFAULT 0,
    "contest_id" "uuid"
);


ALTER TABLE "public"."protection_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."safety_coverage_fund" (
    "id" integer DEFAULT 1 NOT NULL,
    "total_balance" numeric(12,2) DEFAULT 0,
    "total_collected" numeric(12,2) DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."safety_coverage_fund" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "amount" integer,
    "transaction_type" "text",
    "description" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "type" "text" DEFAULT 'credit'::"text" NOT NULL,
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['test_credit'::"text", 'entry'::"text", 'protection_purchase'::"text", 'beta_credit'::"text", 'safety_coverage'::"text", 'platform_fee'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."transactions" IS 'Negative amount = debit; positive = credit in/refund.';



COMMENT ON COLUMN "public"."transactions"."amount" IS 'Signed: negative for charges, positive for credits and refunds.';



CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'protection'::"text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "body" "text" DEFAULT ''::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_sent_at" timestamp with time zone
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."beta_feedback"
    ADD CONSTRAINT "beta_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contest_entries"
    ADD CONSTRAINT "contest_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contest_insurance"
    ADD CONSTRAINT "contest_insurance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contest_insurance_runs"
    ADD CONSTRAINT "contest_insurance_runs_pkey" PRIMARY KEY ("contest_id");



ALTER TABLE ONLY "public"."contest_payouts"
    ADD CONSTRAINT "contest_payouts_contest_id_rank_place_key" UNIQUE ("contest_id", "rank_place");



ALTER TABLE ONLY "public"."contest_payouts"
    ADD CONSTRAINT "contest_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contest_settlements"
    ADD CONSTRAINT "contest_settlements_pkey" PRIMARY KEY ("contest_id");



ALTER TABLE ONLY "public"."contests"
    ADD CONSTRAINT "contests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."founder_updates"
    ADD CONSTRAINT "founder_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."golfer_scores"
    ADD CONSTRAINT "golfer_scores_pkey" PRIMARY KEY ("golfer_id", "contest_id");



ALTER TABLE ONLY "public"."golfers"
    ADD CONSTRAINT "golfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_claims"
    ADD CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."insurance_pool"
    ADD CONSTRAINT "insurance_pool_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineup_players"
    ADD CONSTRAINT "lineup_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lineups"
    ADD CONSTRAINT "lineups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_tiers"
    ADD CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("tier_name");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protection_events"
    ADD CONSTRAINT "protection_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."safety_coverage_fund"
    ADD CONSTRAINT "safety_coverage_fund_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_logs_created_at_desc_idx" ON "public"."admin_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "beta_feedback_created_at_desc_idx" ON "public"."beta_feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "beta_feedback_user_id_idx" ON "public"."beta_feedback" USING "btree" ("user_id");



CREATE INDEX "contest_entries_contest_idx" ON "public"."contest_entries" USING "btree" ("contest_id");



CREATE UNIQUE INDEX "contest_entries_contest_lineup_unique" ON "public"."contest_entries" USING "btree" ("contest_id", "lineup_id") WHERE ("lineup_id" IS NOT NULL);



CREATE INDEX "contest_entries_contest_user_idx" ON "public"."contest_entries" USING "btree" ("contest_id", "user_id");



CREATE INDEX "contest_entries_lineup_id_idx" ON "public"."contest_entries" USING "btree" ("lineup_id");



CREATE UNIQUE INDEX "contest_entries_user_contest_entry_number_uidx" ON "public"."contest_entries" USING "btree" ("user_id", "contest_id", "entry_number");



CREATE INDEX "contest_entries_user_created_idx" ON "public"."contest_entries" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "contest_insurance_contest_id_idx" ON "public"."contest_insurance" USING "btree" ("contest_id");



CREATE UNIQUE INDEX "contest_insurance_contest_id_key" ON "public"."contest_insurance" USING "btree" ("contest_id");



CREATE INDEX "contest_insurance_runs_processed_at_idx" ON "public"."contest_insurance_runs" USING "btree" ("processed_at" DESC);



CREATE INDEX "contest_payouts_contest_id_idx" ON "public"."contest_payouts" USING "btree" ("contest_id");



CREATE INDEX "contest_settlements_settled_at_idx" ON "public"."contest_settlements" USING "btree" ("settled_at" DESC);



CREATE INDEX "contests_created_by_idx" ON "public"."contests" USING "btree" ("created_by");



CREATE INDEX "contests_starts_at_idx" ON "public"."contests" USING "btree" ("starts_at");



CREATE INDEX "golfer_scores_contest_id_idx" ON "public"."golfer_scores" USING "btree" ("contest_id");



CREATE INDEX "golfers_name_idx" ON "public"."golfers" USING "btree" ("name");



CREATE UNIQUE INDEX "golfers_pga_id_key" ON "public"."golfers" USING "btree" ("pga_id");



CREATE INDEX "golfers_salary_desc_idx" ON "public"."golfers" USING "btree" ("salary" DESC);



CREATE INDEX "idx_contest_entries_contest" ON "public"."contest_entries" USING "btree" ("contest_id");



CREATE INDEX "insurance_claims_created_idx" ON "public"."insurance_claims" USING "btree" ("created_at" DESC);



CREATE INDEX "insurance_claims_golfer_idx" ON "public"."insurance_claims" USING "btree" ("golfer_id");



CREATE INDEX "insurance_claims_lineup_idx" ON "public"."insurance_claims" USING "btree" ("lineup_id");



CREATE UNIQUE INDEX "insurance_claims_one_active_per_golfer" ON "public"."insurance_claims" USING "btree" ("lineup_id", "golfer_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'approved'::"text"]));



CREATE INDEX "insurance_claims_user_idx" ON "public"."insurance_claims" USING "btree" ("user_id");



CREATE INDEX "lineup_players_golfer_idx" ON "public"."lineup_players" USING "btree" ("golfer_id");



CREATE INDEX "lineup_players_lineup_idx" ON "public"."lineup_players" USING "btree" ("lineup_id");



CREATE INDEX "lineups_contest_entry_id_idx" ON "public"."lineups" USING "btree" ("contest_entry_id");



CREATE INDEX "lineups_contest_idx" ON "public"."lineups" USING "btree" ("contest_id");



CREATE INDEX "lineups_contest_score_idx" ON "public"."lineups" USING "btree" ("contest_id", "total_score" DESC NULLS LAST) WHERE ("contest_entry_id" IS NOT NULL);



CREATE INDEX "lineups_user_created_idx" ON "public"."lineups" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "profiles_id_idx" ON "public"."profiles" USING "btree" ("id");



CREATE UNIQUE INDEX "profiles_username_lower_unique" ON "public"."profiles" USING "btree" ("lower"("username"));



CREATE INDEX "transactions_user_created_idx" ON "public"."transactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "user_notifications_user_created_idx" ON "public"."user_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "contest_entries_sync_entry_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."contest_entries" FOR EACH ROW EXECUTE FUNCTION "public"."contest_entries_sync_entry_count_trigger"();



CREATE OR REPLACE TRIGGER "enforce_contest_entries_lock" BEFORE INSERT OR UPDATE ON "public"."contest_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_contest_entries_lock"();



CREATE OR REPLACE TRIGGER "enforce_lineup_players_lock" BEFORE INSERT OR DELETE OR UPDATE ON "public"."lineup_players" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_lineup_players_lock"();



CREATE OR REPLACE TRIGGER "enforce_lineups_contest_lock" BEFORE INSERT OR UPDATE ON "public"."lineups" FOR EACH ROW EXECUTE FUNCTION "public"."trg_enforce_lineups_contest_lock"();



CREATE OR REPLACE TRIGGER "profiles_username_before_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_username_before_insert"();



CREATE OR REPLACE TRIGGER "profiles_username_before_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."profiles_username_before_update"();



CREATE OR REPLACE TRIGGER "trg_apply_safety_coverage" BEFORE INSERT ON "public"."contest_entries" FOR EACH ROW EXECUTE FUNCTION "public"."apply_cashcaddies_safety_coverage"();



CREATE OR REPLACE TRIGGER "trg_enforce_beta_approval_senior_admin" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_beta_approval_senior_admin"();



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beta_feedback"
    ADD CONSTRAINT "beta_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contest_entries"
    ADD CONSTRAINT "contest_entries_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contest_entries"
    ADD CONSTRAINT "contest_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."contest_insurance"
    ADD CONSTRAINT "contest_insurance_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contests"
    ADD CONSTRAINT "contests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."golfer_scores"
    ADD CONSTRAINT "golfer_scores_golfer_id_fkey" FOREIGN KEY ("golfer_id") REFERENCES "public"."golfers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lineup_players"
    ADD CONSTRAINT "lineup_players_golfer_id_fkey" FOREIGN KEY ("golfer_id") REFERENCES "public"."golfers"("id");



ALTER TABLE ONLY "public"."lineup_players"
    ADD CONSTRAINT "lineup_players_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "public"."lineups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lineups"
    ADD CONSTRAINT "lineups_contest_entry_id_fkey" FOREIGN KEY ("contest_entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lineups"
    ADD CONSTRAINT "lineups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."protection_events"
    ADD CONSTRAINT "protection_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create contests" ON "public"."contests" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view contests" ON "public"."contests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admins insert own admin_logs" ON "public"."admin_logs" FOR INSERT TO "authenticated" WITH CHECK ((("admin_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("lower"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['admin'::"text", 'senior_admin'::"text"])))))));



CREATE POLICY "Admins read admin_logs" ON "public"."admin_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("lower"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['admin'::"text", 'senior_admin'::"text"]))))));



CREATE POLICY "Admins select all contest entries" ON "public"."contest_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can read contest insurance" ON "public"."contest_insurance" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read contest_payouts" ON "public"."contest_payouts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read contests" ON "public"."contests" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read founder message" ON "public"."founder_updates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read golfer_scores" ON "public"."golfer_scores" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read golfers" ON "public"."golfers" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read insurance pool" ON "public"."insurance_pool" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Founders bypass beta" ON "public"."contest_entries" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Senior admin edit founder message" ON "public"."founder_updates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'senior_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'senior_admin'::"text")))));



CREATE POLICY "Users can view contests" ON "public"."contests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users delete own contest entries" ON "public"."contest_entries" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users delete own lineup_players" ON "public"."lineup_players" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "lineup_players"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users insert own beta feedback" ON "public"."beta_feedback" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users insert own contest entries" ON "public"."contest_entries" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users insert own insurance claims" ON "public"."insurance_claims" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "insurance_claims"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) AND (EXISTS ( SELECT 1
   FROM "public"."lineup_players" "lp"
  WHERE (("lp"."lineup_id" = "insurance_claims"."lineup_id") AND ("lp"."golfer_id" = "insurance_claims"."golfer_id"))))));



CREATE POLICY "Users insert own lineup_players" ON "public"."lineup_players" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "lineup_players"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users insert own lineups" ON "public"."lineups" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users select own beta feedback" ON "public"."beta_feedback" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users select own contest entries" ON "public"."contest_entries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users select own insurance claims" ON "public"."insurance_claims" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users select own lineup_players" ON "public"."lineup_players" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "lineup_players"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users select own lineups" ON "public"."lineups" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users select own notifications" ON "public"."user_notifications" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users select own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users select own transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users update own contest entries" ON "public"."contest_entries" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users update own lineup_players" ON "public"."lineup_players" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "lineup_players"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."lineups" "l"
  WHERE (("l"."id" = "lineup_players"."lineup_id") AND ("l"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users update own lineups" ON "public"."lineups" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users update own notifications" ON "public"."user_notifications" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beta_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contest_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contest_insurance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contest_insurance_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contest_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contest_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."founder_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."golfer_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."golfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."insurance_pool" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lineup_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lineups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_test_funds"("p_user_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_add_beta_funds"("p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_add_beta_funds"("p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_add_beta_funds"("p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_cashcaddies_safety_coverage"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_cashcaddies_safety_coverage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_cashcaddies_safety_coverage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_random_golfer_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_random_golfer_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_random_golfer_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_entries_sync_entry_count_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."contest_entries_sync_entry_count_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_entries_sync_entry_count_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_entry_count"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contest_entry_count"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_entry_count"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_is_past_start"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_leaderboard"("p_contest_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."contest_lineup_count"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."contest_lineup_count"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contest_lineup_count"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_contest_entry_atomic"("p_user_id" "uuid", "p_contest_id" "text", "p_entry_fee" numeric, "p_protection_fee" numeric, "p_total_paid" numeric, "p_protection_enabled" boolean, "p_lineup_id" "uuid", "p_contest_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_beta_approval_senior_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_beta_approval_senior_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_beta_approval_senior_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."founding_tester_approve_beta"("p_target" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."founding_tester_approve_beta"("p_target" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."founding_tester_approve_beta"("p_target" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."founding_tester_list_beta_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."founding_tester_list_beta_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."founding_tester_list_beta_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_temp_profile_username"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_temp_profile_username"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_temp_profile_username"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lineup_roster_locked"("p_lineup_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."loyalty_tier_from_points"("p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."loyalty_tier_from_points"("p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."loyalty_tier_from_points"("p_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_contest_insurance"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_username_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_username_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_username_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."profiles_username_before_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."profiles_username_before_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profiles_username_before_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_for_contest"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_lineup_total_scores_from_golfers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."settle_contest_prizes"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."simulate_all_lineup_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."simulate_all_lineup_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."simulate_all_lineup_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."simulate_contest_lineup_scores"("p_contest_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_contest_entry_count"("p_contest_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_contest_entry_count"("p_contest_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_contest_entry_count"("p_contest_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entries_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entries_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entries_lock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entry_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entry_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enforce_contest_entry_capacity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enforce_lineup_players_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enforce_lineup_players_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enforce_lineup_players_lock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_enforce_lineups_contest_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_enforce_lineups_contest_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_enforce_lineups_contest_lock"() TO "service_role";



GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."beta_feedback" TO "anon";
GRANT ALL ON TABLE "public"."beta_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."beta_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."contest_entries" TO "anon";
GRANT ALL ON TABLE "public"."contest_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_entries" TO "service_role";



GRANT ALL ON TABLE "public"."contest_insurance" TO "anon";
GRANT ALL ON TABLE "public"."contest_insurance" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_insurance" TO "service_role";



GRANT ALL ON TABLE "public"."contest_insurance_runs" TO "anon";
GRANT ALL ON TABLE "public"."contest_insurance_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_insurance_runs" TO "service_role";



GRANT ALL ON TABLE "public"."contest_payouts" TO "anon";
GRANT ALL ON TABLE "public"."contest_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."contest_settlements" TO "anon";
GRANT ALL ON TABLE "public"."contest_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."contest_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."contests" TO "anon";
GRANT ALL ON TABLE "public"."contests" TO "authenticated";
GRANT ALL ON TABLE "public"."contests" TO "service_role";



GRANT ALL ON TABLE "public"."contests_with_stats" TO "anon";
GRANT ALL ON TABLE "public"."contests_with_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."contests_with_stats" TO "service_role";



GRANT ALL ON TABLE "public"."founder_updates" TO "anon";
GRANT ALL ON TABLE "public"."founder_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."founder_updates" TO "service_role";



GRANT ALL ON TABLE "public"."golfer_scores" TO "anon";
GRANT ALL ON TABLE "public"."golfer_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."golfer_scores" TO "service_role";



GRANT ALL ON TABLE "public"."golfers" TO "anon";
GRANT ALL ON TABLE "public"."golfers" TO "authenticated";
GRANT ALL ON TABLE "public"."golfers" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_claims" TO "anon";
GRANT ALL ON TABLE "public"."insurance_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_claims" TO "service_role";



GRANT ALL ON TABLE "public"."insurance_pool" TO "anon";
GRANT ALL ON TABLE "public"."insurance_pool" TO "authenticated";
GRANT ALL ON TABLE "public"."insurance_pool" TO "service_role";



GRANT ALL ON TABLE "public"."lineup_players" TO "anon";
GRANT ALL ON TABLE "public"."lineup_players" TO "authenticated";
GRANT ALL ON TABLE "public"."lineup_players" TO "service_role";



GRANT ALL ON TABLE "public"."lineups" TO "anon";
GRANT ALL ON TABLE "public"."lineups" TO "authenticated";
GRANT ALL ON TABLE "public"."lineups" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_tiers" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."protection_events" TO "anon";
GRANT ALL ON TABLE "public"."protection_events" TO "authenticated";
GRANT ALL ON TABLE "public"."protection_events" TO "service_role";



GRANT ALL ON TABLE "public"."safety_coverage_fund" TO "anon";
GRANT ALL ON TABLE "public"."safety_coverage_fund" TO "authenticated";
GRANT ALL ON TABLE "public"."safety_coverage_fund" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







