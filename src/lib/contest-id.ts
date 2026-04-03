/**
 * Contest catalog ids are UUIDs in the database (`contests.id`, `contest_entries.contest_id`, `lineups.contest_id`).
 * Validate early so PostgREST never sends untyped text into uuid columns.
 */

/** Matches canonical UUID strings PostgreSQL accepts for uuid columns. */
const UUID_HEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Branded type for a validated contest UUID string. */
export type ContestUuid = string & { readonly __brand: "ContestUuid" };

export function isContestUuid(value: string): boolean {
  return UUID_HEX.test(value.trim());
}

/** Returns normalized lowercase UUID or null if missing / invalid / sentinel. */
export function parseContestUuid(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t || t === "default") return null;
  if (!UUID_HEX.test(t)) return null;
  return t.toLowerCase();
}

/** Same as parseContestUuid but narrows to ContestUuid for typed call sites. */
export function requireContestUuid(raw: string, errorMessage = "Invalid contest id."): ContestUuid {
  const id = parseContestUuid(raw);
  if (!id) {
    throw new Error(errorMessage);
  }
  return id as ContestUuid;
}
