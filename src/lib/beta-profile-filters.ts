/**
 * Closed beta: canonical gate is `profiles.beta_status === "approved"` (pending | approved | rejected | waitlist).
 * Legacy rows may still use `beta_user` without status — treat as approved unless explicitly rejected.
 */
export function isProfileBetaApproved(row: {
  beta_user?: boolean | null;
  beta_status?: string | null;
}): boolean {
  const s = typeof row.beta_status === "string" ? row.beta_status.trim().toLowerCase() : "";
  if (s === "rejected") return false;
  if (s === "waitlist") return false;
  if (s === "approved") return true;
  return row.beta_user === true;
}
