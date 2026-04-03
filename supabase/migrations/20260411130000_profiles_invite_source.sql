-- How the user was referred / acquired (staff-editable on beta queue and beta management).

alter table public.profiles
  add column if not exists invite_source text not null default 'organic';

alter table public.profiles drop constraint if exists profiles_invite_source_check;

alter table public.profiles
  add constraint profiles_invite_source_check check (
    invite_source = any (
      array['organic'::text, 'friend'::text, 'twitter'::text, 'reddit'::text, 'email'::text, 'other'::text]
    )
  );

comment on column public.profiles.invite_source is 'Acquisition channel: organic, friend, twitter, reddit, email, other.';
