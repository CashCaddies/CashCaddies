-- Auto-fill profiles.referral_code on insert when not provided (app user table; not auth.users).

create or replace function public.generate_referral_code()
returns trigger
language plpgsql
set search_path to public
as $$
begin
  if new.referral_code is null then
    new.referral_code := substr(md5(random()::text), 1, 8);
  end if;
  return new;
end;
$$;

comment on function public.generate_referral_code() is 'Before insert on profiles: set referral_code from md5 slice when null.';

drop trigger if exists set_referral_code on public.profiles;

create trigger set_referral_code
before insert on public.profiles
for each row
execute function public.generate_referral_code();
