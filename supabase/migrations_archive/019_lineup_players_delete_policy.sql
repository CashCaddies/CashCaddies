-- Allow users to replace roster rows when editing a draft lineup (delete then insert).

drop policy if exists "Users delete own lineup_players" on public.lineup_players;

create policy "Users delete own lineup_players"
  on public.lineup_players
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.lineups l
      where l.id = lineup_players.lineup_id
        and l.user_id = (select auth.uid())
    )
  );
