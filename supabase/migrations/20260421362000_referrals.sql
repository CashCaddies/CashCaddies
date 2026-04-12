-- Referral events: who referred whom (profile ids align with auth.users).

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint referrals_distinct_users check (referrer_id is distinct from referred_id),
  constraint referrals_referrer_referred_unique unique (referrer_id, referred_id)
);

comment on table public.referrals is 'One row per completed referral link (referrer → referred profile).';
comment on column public.referrals.referrer_id is 'Profile that shared the referral.';
comment on column public.referrals.referred_id is 'Profile that signed up via that referral.';

create index if not exists referrals_referrer_id_idx on public.referrals (referrer_id);
create index if not exists referrals_referred_id_idx on public.referrals (referred_id);
create index if not exists referrals_created_at_idx on public.referrals (created_at desc);

alter table public.referrals enable row level security;

drop policy if exists "Users select own referrals" on public.referrals;
create policy "Users select own referrals"
  on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;
