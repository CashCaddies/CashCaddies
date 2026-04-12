-- True when payout JSON is an array of objects whose `percent` values sum to 100 (2 decimal places).

create or replace function public.validate_payout_structure(payout jsonb)
returns boolean
language plpgsql
immutable
set search_path to public
as $$
declare
  total numeric := 0;
  item jsonb;
begin
  if payout is null or jsonb_typeof(payout) <> 'array' then
    return false;
  end if;

  for item in select jsonb_array_elements(payout)
  loop
    total := total + coalesce(nullif(trim(item ->> 'percent'), '')::numeric, 0);
  end loop;

  return round(total, 2) = 100;
end;
$$;

comment on function public.validate_payout_structure(jsonb) is
  'Sums numeric `percent` on each array element; valid when rounded total equals 100.';

revoke all on function public.validate_payout_structure(jsonb) from public;

grant execute on function public.validate_payout_structure(jsonb) to authenticated;
grant execute on function public.validate_payout_structure(jsonb) to service_role;
