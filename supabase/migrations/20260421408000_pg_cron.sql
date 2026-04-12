-- Job scheduler (cron inside Postgres). Must live in pg_catalog (not `extensions`).
-- On Supabase hosted: enable “pg_cron” under Database → Extensions if CREATE EXTENSION fails.

create extension if not exists pg_cron with schema pg_catalog;
