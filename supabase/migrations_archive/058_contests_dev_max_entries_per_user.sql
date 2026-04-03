-- Development testing: raise per-user entry cap when the dev wallet flag is on (same signal as add_test_funds).
-- No application code changes. Idempotent.
-- Production: keep app_config.allow_test_wallet_funding = false so this updates 0 rows.

update public.contests c
set max_entries_per_user = 10
where exists (
  select 1
  from public.app_config cfg
  where cfg.key = 'allow_test_wallet_funding'
    and lower(trim(cfg.value)) = 'true'
);
