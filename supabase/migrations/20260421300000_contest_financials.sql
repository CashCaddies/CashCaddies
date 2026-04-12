-- Per-contest revenue snapshot: total entry fees, 5% rake (platform slice in this model),
-- 90% prize pool (matches settle_contest_prizes / entry_fee_split_90_5_5 prize side).
-- Remaining 5% is allocated to protection via apply_contest_entry_fee_allocation (not stored here).

create table if not exists public.contest_financials (
  contest_id uuid primary key references public.contests (id) on delete cascade,
  total_entry_fees numeric not null,
  rake_usd numeric not null,
  prize_pool_usd numeric not null,
  profit_usd numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contest_financials is
  'Denormalized contest economics: sum(entry_fee), 5% rake, 90% prize pool; profit_usd mirrors rake in this model.';

create index if not exists contest_financials_updated_at_idx on public.contest_financials (updated_at desc);

alter table public.contest_financials enable row level security;

drop policy if exists "Admins select contest_financials" on public.contest_financials;
create policy "Admins select contest_financials"
  on public.contest_financials for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and lower(coalesce(p.role, '')) in ('admin', 'senior_admin')
    )
  );

grant select on public.contest_financials to authenticated;
grant select, insert, update, delete on public.contest_financials to service_role;

drop function if exists public.calculate_contest_financials(text);

create or replace function public.calculate_contest_financials(p_contest_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cid uuid;
  v_total_fees numeric;
  v_rake numeric;
  v_prize_pool numeric;
  v_profit numeric;
begin
  if p_contest_id is null or trim(p_contest_id) = '' then
    return jsonb_build_object('ok', false, 'error', 'Missing contest id.');
  end if;

  begin
    v_cid := trim(p_contest_id)::uuid;
  exception
    when invalid_text_representation then
      return jsonb_build_object('ok', false, 'error', 'Invalid contest id.');
  end;

  select coalesce(sum(coalesce(ce.entry_fee::numeric, 0)), 0)
  into v_total_fees
  from public.contest_entries ce
  where ce.contest_id = v_cid;

  v_rake := round(v_total_fees * 0.05, 2);
  v_prize_pool := round(v_total_fees * 0.90, 2);
  v_profit := v_rake;

  insert into public.contest_financials (
    contest_id,
    total_entry_fees,
    rake_usd,
    prize_pool_usd,
    profit_usd
  )
  values (
    v_cid,
    v_total_fees,
    v_rake,
    v_prize_pool,
    v_profit
  )
  on conflict (contest_id) do update
  set
    total_entry_fees = excluded.total_entry_fees,
    rake_usd = excluded.rake_usd,
    prize_pool_usd = excluded.prize_pool_usd,
    profit_usd = excluded.profit_usd,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'contest_id', trim(p_contest_id),
    'total_entry_fees', v_total_fees,
    'rake', v_rake,
    'prize_pool_usd', v_prize_pool,
    'profit', v_profit
  );
end;
$$;

comment on function public.calculate_contest_financials(text) is
  'Recompute and upsert contest_financials from sum(contest_entries.entry_fee); 5% rake, 90% prize pool.';

grant execute on function public.calculate_contest_financials(text) to service_role;
grant execute on function public.calculate_contest_financials(text) to authenticated;
