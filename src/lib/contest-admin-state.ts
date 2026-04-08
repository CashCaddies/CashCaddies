/**
 * Valid values for `contests.contest_status` (Postgres enum `contest_state`).
 * Used by admin contest creation so invalid strings are never sent to Supabase.
 */
export const CONTEST_STATE_VALUES = [
  "draft",
  "open",
  "locked",
  "live",
  "completed",
  "settled",
] as const;

export type ContestStateValue = (typeof CONTEST_STATE_VALUES)[number];

export function normalizeContestStateForInsert(raw: string | null | undefined): ContestStateValue {
  const t = String(raw ?? "").trim().toLowerCase();
  if ((CONTEST_STATE_VALUES as readonly string[]).includes(t)) {
    return t as ContestStateValue;
  }
  return "draft";
}

/**
 * Legacy `contests.status` column (baseline CHECK) allows:
 * open | locked | live | completed | cancelled | paid
 */
export function legacyContestsStatusText(state: ContestStateValue): string {
  switch (state) {
    case "draft":
    case "open":
      return "open";
    case "locked":
      return "locked";
    case "live":
      return "live";
    case "completed":
      return "completed";
    case "settled":
      return "paid";
    default:
      return "open";
  }
}
