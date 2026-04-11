-- Contest entry hardening: ensure capacity trigger is attached (baseline ships the function; some DBs may lack the trigger).
-- We do NOT add UNIQUE(user_id, contest_id) — multiple rows per user per contest are valid when max_entries_per_user > 1.

do $$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'contest_entries'
      and t.tgname = 'enforce_contest_entry_capacity'
  ) then
    create trigger enforce_contest_entry_capacity
      before insert on public.contest_entries
      for each row execute function public.trg_enforce_contest_entry_capacity();
  end if;
end $$;

comment on trigger enforce_contest_entry_capacity on public.contest_entries is
  'Before INSERT: locks parent contest row and enforces max_entries and max_entries_per_user (race-safe).';
