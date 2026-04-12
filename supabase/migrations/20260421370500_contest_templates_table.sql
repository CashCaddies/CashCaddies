-- Blueprint rows for creating contests (indexes + RLS in later migrations assume this table).

create table if not exists public.contest_templates (
  id uuid not null default gen_random_uuid() primary key,
  name text not null,
  description text,
  entry_fee_cents integer not null default 0,
  max_entries integer not null default 100,
  max_entries_per_user integer not null default 1,
  prize_pool_type text not null default 'fixed',
  prize_pool_cents integer,
  rake_percent numeric,
  payout_structure jsonb not null default '[]'::jsonb,
  sport text not null default 'golf',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contest_templates_entry_fee_cents_non_negative check (entry_fee_cents >= 0),
  constraint contest_templates_max_entries_positive check (max_entries > 0),
  constraint contest_templates_max_entries_per_user_positive check (max_entries_per_user > 0)
);

comment on table public.contest_templates is 'Reusable contest configuration templates for admin-created contests.';

alter table public.contest_templates owner to postgres;
