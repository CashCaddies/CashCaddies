-- Portal: accumulate season_contribution from contest entry fees (app calls after successful entry).

alter table public.profiles
  add column if not exists season_contribution numeric not null default 0;

create or replace function public.increment_contribution(user_id uuid, amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if amount is null or amount <= 0 then
    return;
  end if;

  -- Authenticated callers must only update their own row; service_role may update any (server actions).
  if auth.uid() is not null and auth.uid() is distinct from user_id then
    raise exception 'increment_contribution: user mismatch';
  end if;

  update public.profiles
  set season_contribution = coalesce(season_contribution, 0) + amount
  where id = user_id;
end;
$$;

comment on function public.increment_contribution(uuid, numeric) is
  'Adds amount to profiles.season_contribution for portal tiering; called after successful contest entry.';

revoke all on function public.increment_contribution(uuid, numeric) from public;
grant execute on function public.increment_contribution(uuid, numeric) to authenticated;
grant execute on function public.increment_contribution(uuid, numeric) to service_role;
