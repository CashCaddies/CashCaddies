-- Spendable balance cannot go negative (cent integer). CashCaddies core wallet is `profiles.account_balance`;
-- this applies when a separate `public.wallets` table exists (e.g. remote schema).

do $migration$
begin
  alter table public.wallets
    add constraint check_non_negative_balance
    check (balance_cents >= 0);
exception
  when undefined_table then
    raise notice 'migration 20260421389000: public.wallets missing; skipped check_non_negative_balance';
  when duplicate_object then
    null;
end;
$migration$;
