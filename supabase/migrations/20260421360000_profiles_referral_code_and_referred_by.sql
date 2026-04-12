-- Per-user referral: shareable code and optional link to the referring profile (same id space as auth.users).

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

comment on column public.profiles.referral_code is 'Unique invite code for this user; null until assigned.';
comment on column public.profiles.referred_by is 'Profile id of the user who referred this account, if any.';

-- Uniqueness when referral_code is set (multiple nulls allowed).
create unique index if not exists profiles_referral_code_key on public.profiles (referral_code);
