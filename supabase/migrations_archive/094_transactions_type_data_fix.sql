-- Align legacy transactions.type values with transactions_type_check (080). UPDATE only.

select distinct type as invalid_type_before
from public.transactions
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

update public.transactions
set type = 'contest_entry'
where type = 'contest-entry';

update public.transactions
set type = 'contest_prize'
where type = 'prize';

update public.transactions
set type = 'contest_insurance_payout'
where type = 'insurance_payout';

do $$
declare
  r record;
begin
  for r in (
    select distinct type as v
    from public.transactions
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
    )
  ) loop
    raise notice 'Invalid transactions.type after update: %', r.v;
  end loop;
end
$$;

select distinct type as invalid_type_after
from public.transactions
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
