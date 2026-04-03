import { parseContestUuid } from "@/lib/contest-id";

/**
 * `lineups.contest_id` in the database: real contest UUID, or null when not assigned.
 * Do not persist the UI sentinel `"default"` (breaks UUID columns and is ambiguous).
 */
export function lineupContestIdForDb(raw: string | null | undefined): string | null {
  return parseContestUuid(raw);
}
