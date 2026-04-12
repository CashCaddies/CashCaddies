-- Idempotent entry submissions (e.g. retry-safe RPC). Real table is public.contest_entries, not `entries`.

alter table public.contest_entries
  add column if not exists idempotency_key text;

create unique index if not exists uniq_idempotency_key
  on public.contest_entries (idempotency_key)
  where idempotency_key is not null;

comment on column public.contest_entries.idempotency_key is
  'Optional client-supplied key; at most one contest_entries row per non-null value (partial unique index).';
