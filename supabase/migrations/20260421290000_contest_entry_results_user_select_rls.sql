-- Allow each user to read their own payout rows (dashboard "My Winnings").

drop policy if exists "Users select own contest entry results" on public.contest_entry_results;

create policy "Users select own contest entry results"
  on public.contest_entry_results
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
