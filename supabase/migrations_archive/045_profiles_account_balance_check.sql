-- Non-negative account_balance on profiles (wallet safety).

alter table public.profiles
  drop constraint if exists profiles_account_balance_non_negative;

alter table public.profiles
  add constraint profiles_account_balance_non_negative
  check (account_balance >= 0);

comment on constraint profiles_account_balance_non_negative on public.profiles is
  'Spendable balance cannot go negative; contest entry and other debits must check before update.';
