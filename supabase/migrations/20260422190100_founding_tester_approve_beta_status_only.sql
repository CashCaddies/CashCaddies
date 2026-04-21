-- Gate uses profiles.beta_status = 'approved'; do not maintain legacy beta_access writes here.
create or replace function public.founding_tester_approve_beta(p_target uuid) returns void
  language plpgsql
  security definer
  set search_path to public
as $$
begin
  update public.profiles
  set
    beta_user = true,
    beta_status = 'approved',
    founding_tester = true,
    beta_waitlist = false,
    beta_approved_at = now(),
    updated_at = now()
  where id = p_target;
end;
$$;
