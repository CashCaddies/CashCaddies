do $cc$
begin
  create type public.simulation_scope as enum ('ENTRY', 'CONTEST');
exception
  when duplicate_object then null;
end
$cc$;

do $$
declare
  r record;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'simulations'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
  ) then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
      and udt_name = 'simulation_scope'
  ) then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulations'
      and column_name = 'simulation_type'
      and udt_name = 'text'
  ) then
    return;
  end if;

  alter table public.simulations alter column simulation_type drop default;

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

  for r in (
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'simulations'
      and indexdef ilike '%simulation_type%'
  ) loop
    execute format('drop index if exists public.%I', r.indexname);
  end loop;

  alter table public.simulations
    alter column simulation_type type public.simulation_scope
    using simulation_type::public.simulation_scope;

  alter table public.simulations
    alter column simulation_type set default 'CONTEST'::public.simulation_scope;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulations_entry_scope_check'
  ) then
    alter table public.simulations
      add constraint simulations_entry_scope_check check (
        (simulation_type = 'ENTRY' and entry_id is not null)
        or simulation_type = 'CONTEST'
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulations_simulation_type_check'
  ) then
    alter table public.simulations
      add constraint simulations_simulation_type_check check (simulation_type in ('ENTRY', 'CONTEST'));
  end if;
end
$$;
