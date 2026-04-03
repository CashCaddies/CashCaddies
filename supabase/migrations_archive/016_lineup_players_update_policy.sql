-- Allow users to update is_protected on their own lineups (e.g. CashCaddie Protection at contest entry).

drop policy if exists "Users update own lineup_players" on public.lineup_players;

create policy "Users update own lineup_players"
  on public.lineup_players
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.lineups l
      where l.id = lineup_players.lineup_id
        and l.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.lineups l
      where l.id = lineup_players.lineup_id
        and l.user_id = (select auth.uid())
    )
  );
