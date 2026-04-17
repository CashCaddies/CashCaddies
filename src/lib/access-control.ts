/**
 * Premium / beta access for advanced DFS surfaces (tee waves, ownership, filters).
 * - `is_beta_tester`: admin-granted free premium tools (no Stripe).
 * - `premium_expires_at`: Stripe billing period end; active paid premium while this instant is in the future.
 */

export type DfsPremiumProfileSlice = {
  is_beta_tester?: boolean | null;
  /** Stripe `current_period_end` (ISO). Paid premium is active while this is in the future. */
  premium_expires_at?: string | null;
};

/**
 * Active paid premium (Stripe) inferred from `premium_expires_at` only.
 * Beta-only users (`is_beta_tester` without a future `premium_expires_at`) are false here.
 */
export function hasActivePaidPremium(
  row: Pick<DfsPremiumProfileSlice, "premium_expires_at"> | null | undefined,
): boolean {
  if (!row) {
    return false;
  }
  const exp = row.premium_expires_at;
  if (exp == null || String(exp).trim() === "") {
    return false;
  }
  const t = Date.parse(String(exp));
  if (!Number.isFinite(t)) {
    return false;
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
