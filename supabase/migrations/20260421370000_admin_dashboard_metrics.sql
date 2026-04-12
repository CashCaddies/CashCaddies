-- Single RPC for admin Command Center aggregates (depends on admin_total_* / admin_active_contests).

create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path to public
stable
as $$
declare
  v_users int;
  v_deposits numeric;
  v_entry_fees numeric;
  v_payouts numeric;
  v_active int;
begin
  select public.admin_total_users() into v_users;
  select public.admin_total_deposits() into v_deposits;
  select public.admin_total_entry_fees() into v_entry_fees;
  select public.admin_total_payouts() into v_payouts;
  select public.admin_active_contests() into v_active;

  return jsonb_build_object(
    'total_users', v_users,
    'total_deposits', v_deposits,
    'total_entry_fees', v_entry_fees,
    'total_payouts', v_payouts,
    'active_contests', v_active,
    'profit', round(coalesce(v_entry_fees, 0) - coalesce(v_payouts, 0), 2)
  );
end;
$$;

comment on function public.admin_dashboard_metrics() is
  'Aggregates admin_total_users, deposits, entry fees, payouts, active contests, and entry_fees - payouts. Service role only.';

revoke all on function public.admin_dashboard_metrics() from public;

grant execute on function public.admin_dashboard_metrics() to service_role;
