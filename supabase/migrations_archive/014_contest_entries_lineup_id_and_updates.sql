-- Link contest_entries to the lineup roster; enable users to update own lineups for entry completion.

alter table public.contest_entries
  add column if not exists lineup_id uuid references public.lineups (id) on delete set null;

create index if not exists contest_entries_lineup_id_idx on public.contest_entries (lineup_id);

comment on column public.contest_entries.lineup_id is 'Roster this entry pays for; set when entering with a saved lineup or after lineup insert.';

-- Allow users to attach contest_entry_id / fees to their own draft lineups when entering.
drop policy if exists "Users update own lineups" on public.lineups;
create policy "Users update own lineups"
  on public.lineups
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Free entries: link lineup_id on contest_entries after roster save (when service role is unavailable).
drop policy if exists "Users update own contest entries" on public.contest_entries;
create policy "Users update own contest entries"
  on public.contest_entries
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
