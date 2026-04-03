/**
 * Normalize `contests.id` for RPC args (`p_contest_id`). Use the contest row’s primary key only —
 * never a slug field, display name, or unrelated param.
 */
export function contestIdForRpc(contestId: string): string | null {
  const s = contestId.trim();
  return s.length > 0 ? s : null;
}
