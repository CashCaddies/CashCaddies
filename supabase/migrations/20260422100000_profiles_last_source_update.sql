-- Attribution: which homepage update CTA led the user to sign up (founder_updates.id).

alter table public.profiles
  add column if not exists last_source_update uuid references public.founder_updates (id) on delete set null;

comment on column public.profiles.last_source_update is 'Most recent founder update id from CTA (?source_update=) at signup/login.';
