-- Total contest entry fees charged (legacy ledger). `create_contest_entry_atomic` records debits as
-- `public.transactions` rows with type `entry` (negative amounts); there is no `status` column on that table.
-- When/if entries move to `wallet_transactions` (`contest_entry` + `completed`), replace or extend this query.

create or replace function public.admin_total_entry_fees()
returns numeric
language sql
security definer
set search_path to public
stable
as $$
  select coalesce(sum(abs(t.amount::numeric)), 0)::numeric
  from public.transactions t
  where t.type = 'entry';
$$;

comment on function public.admin_total_entry_fees() is
  'Sum of abs(amount) for legacy transactions.type = entry (contest entry fee debits). Service role only.';

revoke all on function public.admin_total_entry_fees() from public;

grant execute on function public.admin_total_entry_fees() to service_role;
