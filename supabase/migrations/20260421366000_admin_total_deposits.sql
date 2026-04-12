-- Sum completed deposit amounts from the wallet ledger (not legacy `public.transactions`, which has no deposit/status columns).

create or replace function public.admin_total_deposits()
returns numeric
language sql
security definer
set search_path to public
stable
as $$
  select coalesce(sum(wt.amount), 0)::numeric
  from public.wallet_transactions wt
  where wt.type = 'deposit'
    and wt.status = 'completed';
$$;

comment on function public.admin_total_deposits() is
  'Sum of completed deposit amounts from wallet_transactions. Use with service role from trusted server.';

revoke all on function public.admin_total_deposits() from public;

grant execute on function public.admin_total_deposits() to service_role;
