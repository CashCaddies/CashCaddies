-- Par by hole index 1–18 (repeats each round). Pass cumulative hole (1–72) or within-round 1–18.

create or replace function public.get_hole_par(p_hole int)
returns int
language plpgsql
immutable
security definer
set search_path to public
as $$
declare
  h int;
begin
  if p_hole is null then
    return 4;
  end if;

  h := ((greatest(1, p_hole) - 1) % 18) + 1;

  case h
    when 1 then return 4;
    when 2 then return 5;
    when 3 then return 4;
    when 4 then return 3;
    when 5 then return 4;
    when 6 then return 4;
    when 7 then return 3;
    when 8 then return 5;
    when 9 then return 4;
    when 10 then return 4;
    when 11 then return 4;
    when 12 then return 5;
    when 13 then return 3;
    when 14 then return 4;
    when 15 then return 4;
    when 16 then return 3;
    when 17 then return 5;
    when 18 then return 4;
    else return 4;
  end case;
end;
$$;

comment on function public.get_hole_par(int) is
  'Returns par for hole 1–18 layout; p_hole may be cumulative (uses mod 18).';

revoke all on function public.get_hole_par(int) from public;

grant execute on function public.get_hole_par(int) to anon;
grant execute on function public.get_hole_par(int) to authenticated;
grant execute on function public.get_hole_par(int) to service_role;
