comment on function public.create_contest_entry_atomic(
  uuid, text, numeric, numeric, numeric, boolean, uuid, text
) is
  'Atomic: contest_entries + wallet debit from account_balance only. Insufficient balance raises (rollback). Balance cannot go negative (CHECK + runtime assert).';
