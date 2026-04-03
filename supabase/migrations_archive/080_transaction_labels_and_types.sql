-- Normalize user-facing transaction labels/types.

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
