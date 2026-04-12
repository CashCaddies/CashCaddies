-- Dedupe external deposits (e.g. same Stripe payment_intent_id applied twice).
--
-- A full UNIQUE (reference_id, type) on the table would break contest winnings:
-- many rows share reference_id = contest_id and type = 'winnings'.
-- We only enforce uniqueness for deposits with a non-null provider reference.

create unique index if not exists wallet_transactions_deposit_reference_uidx
  on public.wallet_transactions (reference_id, type)
  where type = 'deposit' and reference_id is not null;

comment on index public.wallet_transactions_deposit_reference_uidx is
  'One completed ledger row per external deposit reference (e.g. Stripe payment_intent_id).';
