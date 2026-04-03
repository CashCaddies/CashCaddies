do $cc$
begin
  create type public.simulation_scope as enum ('ENTRY', 'CONTEST');
exception
  when duplicate_object then null;
end
$cc$;

do $$
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
      and udt_name = 'text'
  ) then
    return;
  end if;

  alter table public.simulations alter column simulation_type drop default;

  alter table public.simulations drop constraint if exists simulations_entry_scope_check;
  alter table public.simulations drop constraint if exists simulations_simulation_type_check;

  alter table public.simulations
    alter column simulation_type type public.simulation_scope
    using simulation_type::public.simulation_scope;

  alter table public.simulations
    alter column simulation_type set default 'ENTRY'::public.simulation_scope;

  alter table public.simulations
    add constraint simulations_entry_scope_check check (
      (simulation_type = 'ENTRY' and entry_id is not null)
      or simulation_type = 'CONTEST'
    );

  alter table public.simulations
    add constraint simulations_simulation_type_check check (simulation_type in ('ENTRY', 'CONTEST'));
end
$$;
