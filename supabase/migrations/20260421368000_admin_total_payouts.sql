-- Total contest prize dollars credited to users. Recorded as legacy `public.transactions` with type `contest_prize`
-- (positive amounts). There is no `status` column; `wallet_transactions` `winnings` rows exist only for flows that call
-- `credit_contest_winnings`, so summing the legacy ledger avoids missing `settle_contest_prizes`-only payouts.

create or replace function public.admin_total_payouts()
returns numeric
language sql
security definer
set search_path to public
stable
as $$
  select coalesce(sum(t.amount::numeric), 0)::numeric
  from public.transactions t
  where t.type = 'contest_prize';
$$;

comment on function public.admin_total_payouts() is
  'Sum of contest_prize credits in legacy transactions (all settlement paths). Service role only.';

revoke all on function public.admin_total_payouts() from public;

grant execute on function public.admin_total_payouts() to service_role;
