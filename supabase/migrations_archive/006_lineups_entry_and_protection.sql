-- Entry fees and CashCaddie Protection per lineup submission.

alter table public.lineups
  add column if not exists entry_fee numeric not null default 0,
  add column if not exists protection_fee numeric not null default 0,
  add column if not exists total_paid numeric not null default 0,
  add column if not exists protection_enabled boolean not null default false;

comment on column public.lineups.entry_fee is 'Contest entry fee in USD at time of entry.';
comment on column public.lineups.protection_fee is 'CashCaddie Protection add-on in USD (0 if disabled).';
comment on column public.lineups.total_paid is 'entry_fee + protection_fee';
comment on column public.lineups.protection_enabled is 'Whether CashCaddie Protection was purchased.';
