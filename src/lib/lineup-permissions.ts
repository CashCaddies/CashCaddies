/**
 * Whether the user has completed contest entry for this lineup (`lineups.contest_entry_id` set).
 * Only drafts (no contest entry) may be edited in the lineup builder.
 */
export function lineupHasContestEntry(lineup: {
  contest_entry_id: string | null | undefined;
}): boolean {
  return lineup.contest_entry_id != null;
}
