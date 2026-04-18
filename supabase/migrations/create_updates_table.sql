create or replace function public.create_updates_table()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  create table if not exists updates (
    id uuid primary key default gen_random_uuid(),
    title text,
    content text,
    tag text,
    created_at timestamp with time zone default now()
  );
end;
$$;
