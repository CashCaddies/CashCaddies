-- Broadcast insurance_pool row updates so the Community Protection Fund banner can subscribe (read-only UI).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.insurance_pool';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;
