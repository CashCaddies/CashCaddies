do $$
declare
  r record;
  v_expr text;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'simulations'
  ) then
    update public.simulations
    set simulation_type = case lower(trim(simulation_type))
      when 'contest' then 'CONTEST'
      when 'entry' then 'ENTRY'
      else simulation_type
    end
    where simulation_type is not null
      and lower(trim(simulation_type)) in ('contest', 'entry');

    for r in (
      select distinct simulation_type as v
      from public.simulations
      where simulation_type is not null
        and simulation_type not in ('ENTRY', 'CONTEST')
    ) loop
      raise notice 'Invalid simulation_type value: %', r.v;
    end loop;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'simulations'
        and column_name = 'simulation_type'
    ) then
      select pg_get_expr(ad.adbin, ad.adrelid)
      into v_expr
      from pg_attrdef ad
      join pg_attribute a on a.attrelid = ad.adrelid and a.attnum = ad.adnum
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'simulations'
        and a.attname = 'simulation_type'
      limit 1;

      if v_expr is not null
        and not (v_expr ~ '^''(ENTRY|CONTEST)''::' or v_expr ~ '^''(ENTRY|CONTEST)''$')
      then
        alter table public.simulations alter column simulation_type drop default;
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'simulations'
        and column_name = 'simulation_type'
    ) then
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'simulations'
          and column_name = 'simulation_type'
          and udt_name = 'text'
      ) then
        alter table public.simulations
          alter column simulation_type set default 'CONTEST';
      elsif exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'simulations'
          and column_name = 'simulation_type'
          and udt_name = 'simulation_scope'
      ) then
        alter table public.simulations
          alter column simulation_type set default 'CONTEST'::public.simulation_scope;
      end if;
    end if;
  end if;
end
$$;
