/** Lower bound USD contribution for portal tiers 1–5 (same breakpoints as tier assignment). */
export const PORTAL_TIER_MIN_USD: readonly number[] = [0, 100, 500, 2000, 10000];

export type PortalContributionTier = 1 | 2 | 3 | 4 | 5;

export function getTierFromContribution(amount: number): PortalContributionTier {
  const n = Math.max(0, Number(amount) || 0);
  if (n >= 10_000) return 5;
  if (n >= 2_000) return 4;
  if (n >= 500) return 3;
  if (n >= 100) return 2;
  return 1;
}

export type PortalTierProgress = {
  tier: PortalContributionTier;
  currentMin: number;
  nextThreshold: number | null;
  progressPercent: number;
  amountToNext: number;
};

/** Progress within the current tier toward the next (contribution USD). */
export function getPortalTierProgress(contribution: number): PortalTierProgress {
  const n = Math.max(0, Number(contribution) || 0);
  const tier = getTierFromContribution(n);
  if (tier === 5) {
    return {
      tier,
      currentMin: PORTAL_TIER_MIN_USD[4],
      nextThreshold: null,
      progressPercent: 100,
      amountToNext: 0,
    };
  }
  const idx = tier - 1;
  const currentMin = PORTAL_TIER_MIN_USD[idx] ?? 0;
  const nextThreshold = PORTAL_TIER_MIN_USD[idx + 1] ?? null;
  if (nextThreshold == null) {
    return { tier, currentMin, nextThreshold: null, progressPercent: 100, amountToNext: 0 };
  }
  const span = nextThreshold - currentMin;
  const progressPercent =
    span > 0 ? Math.min(100, Math.max(0, ((n - currentMin) / span) * 100)) : 100;
  const amountToNext = Math.max(0, nextThreshold - n);
  return { tier, currentMin, nextThreshold, progressPercent, amountToNext };
}
