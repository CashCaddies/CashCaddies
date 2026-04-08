/**
 * Valid values for `contests.contest_status` (Postgres enum `contest_state`).
 * Used by admin contest creation so invalid strings are never sent to Supabase.
 * `cancelled` is omitted: set only after refunding entries (not from this form).
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

/** Admin table: `contests.contest_status` pill (lobby-style labels; `open` shows as Filling). */
export function contestStatusBadgeLabel(status: string | null | undefined): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "") return "—";
  const map: Record<string, string> = {
    draft: "Draft",
    open: "Filling",
    locked: "Locked",
    live: "Live",
    completed: "Completed",
    settled: "Settled",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };
  return map[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export function contestStatusBadgeClassName(status: string | null | undefined): string {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "draft":
      return "bg-[#252a32] text-[#8b98a5] border-[#3d4550]";
    case "open":
      return "bg-[#1a2f4a] text-[#7ab8ff] border-[#3d6a9e]";
    case "locked":
      return "bg-[#3d2a1a] text-[#ffb14a] border-[#8b5a2b]";
    case "live":
      return "bg-[#142e1c] text-[#53d769] border-[#2d7a3a]";
    case "completed":
      return "bg-[#2a1f3d] text-[#c4a8ff] border-[#5c4a7a]";
    case "settled":
      return "bg-[#3d3420] text-[#e8c96a] border-[#8a7630]";
    case "cancelled":
    case "canceled":
      return "bg-[#2a2323] text-[#9a9a9a] border-[#454545]";
    default:
      return "bg-[#1a1f26] text-[#8b98a5] border-[#3d4550]";
  }
}
