do $cc$
begin
  create type public.simulation_scope as enum ('ENTRY', 'CONTEST');
exception
  when duplicate_object then null;
end
$cc$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
  ) then
    alter table public.simulations alter column simulation_type drop default;
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in (
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'simulations'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%simulation_type%'
  ) loop
    execute format('alter table public.simulations drop constraint if exists %I', r.conname);
  end loop;
end
$$;

do $$
declare
  r record;
begin
  for r in (
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'simulations'
      and indexdef ilike '%simulation_type%'
  ) loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
      and udt_name = 'text'
  ) then
    alter table public.simulations
      alter column simulation_type type public.simulation_scope
      using simulation_type::public.simulation_scope;
  end if;
end
$$;

do $$
begin
  if exists (
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
end
$$;
