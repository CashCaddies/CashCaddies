/**
 * Premium / beta access for advanced DFS surfaces (tee waves, ownership, filters).
 * - `is_beta_tester`: admin-granted free premium tools (no Stripe).
 * - `is_premium` + `premium_expires_at`: paid (Stripe) or admin-granted; expiry gates paid access after period.
 */

export type DfsPremiumProfileSlice = {
  is_beta_tester?: boolean | null;
  is_premium?: boolean | null;
  /** When set, paid premium access ends after this instant (Stripe current_period_end). */
  premium_expires_at?: string | null;
};

/**
 * Paid (or admin-flagged) premium with optional Stripe billing period.
 * Beta-only users (`is_beta_tester` without `is_premium`) are false here.
 */
export function hasActivePaidPremium(
  row: Pick<DfsPremiumProfileSlice, "is_premium" | "premium_expires_at"> | null | undefined,
): boolean {
  if (!row || row.is_premium !== true) {
    return false;
  }
  const exp = row.premium_expires_at;
  if (exp == null || String(exp).trim() === "") {
    return true;
  }
  const t = Date.parse(String(exp));
  if (!Number.isFinite(t)) {
    return true;
  }
  return t > Date.now();
}

/** True when the viewer should see advanced DFS tools (tee waves, ownership, wave filters). */
export function hasDfsPremiumAccess(profile: DfsPremiumProfileSlice | null | undefined): boolean {
  if (!profile) {
    return false;
  }
  if (profile.is_beta_tester === true) {
    return true;
  }
  return hasActivePaidPremium(profile);
}
