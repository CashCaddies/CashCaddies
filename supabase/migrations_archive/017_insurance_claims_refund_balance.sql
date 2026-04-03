-- Allow account-balance entry-fee refunds on protection claims; track refund amounts.

alter table public.insurance_claims
  drop constraint if exists insurance_claims_claim_type_check;

alter table public.insurance_claims
  add constraint insurance_claims_claim_type_check
  check (claim_type in ('swap', 'refund_credit', 'refund_balance'));

alter table public.insurance_claims
  add column if not exists refund_amount_usd numeric;

comment on column public.insurance_claims.refund_amount_usd is
  'Entry fee refunded or credited when claim is approved (null for pending swap / manual review).';
