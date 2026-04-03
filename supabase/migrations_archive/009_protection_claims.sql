-- Withdrawn flag on golfers; tighten insurance_claims for CashCaddie Protection claims.

alter table public.golfers
  add column if not exists withdrawn boolean not null default false;

comment on column public.golfers.withdrawn is 'WD before lock — triggers protection claim eligibility when lineup has protection.';

-- Normalize existing rows before constraints (safe if empty).
update public.insurance_claims
set claim_type = 'swap'
where claim_type is null or claim_type not in ('swap', 'refund_credit');

update public.insurance_claims
set status = 'pending'
where status is null or status not in ('pending', 'approved', 'denied');

alter table public.insurance_claims
  drop constraint if exists insurance_claims_status_check;

alter table public.insurance_claims
  add constraint insurance_claims_status_check check (status in ('pending', 'approved', 'denied'));

alter table public.insurance_claims
  drop constraint if exists insurance_claims_claim_type_check;

alter table public.insurance_claims
  add constraint insurance_claims_claim_type_check check (claim_type in ('swap', 'refund_credit'));

create unique index if not exists insurance_claims_one_active_per_golfer
  on public.insurance_claims (lineup_id, golfer_id)
  where status in ('pending', 'approved');
