/** Loyalty points earned only from contest entry fees (not protection or other fees). */
export const LOYALTY_POINTS_PER_ENTRY_DOLLAR = 10;

export const TIER_MIN_POINTS = {
  Bronze: 0,
  Silver: 500,
  Gold: 2500,
  Platinum: 10000,
} as const;

export type TierName = keyof typeof TIER_MIN_POINTS;

export const TIER_ORDER: TierName[] = ["Bronze", "Silver", "Gold", "Platinum"];

/** CashCaddies Safety Coverage perks by loyalty tier (max golfers covered per lineup + fee discount). */
export const TIER_BENEFITS: Record<
  TierName,
  { maxProtectedGolfers: number; protectionDiscountPercent: number }
> = {
  Bronze: { maxProtectedGolfers: 1, protectionDiscountPercent: 0 },
  Silver: { maxProtectedGolfers: 2, protectionDiscountPercent: 10 },
  Gold: { maxProtectedGolfers: 3, protectionDiscountPercent: 25 },
  Platinum: { maxProtectedGolfers: 4, protectionDiscountPercent: 50 },
};

export function maxProtectedGolfersForTier(tier: TierName): number {
  return TIER_BENEFITS[tier].maxProtectedGolfers;
}

/** 0–1 discount applied to the protection subtotal (per-golfer base × count). */
export function protectionDiscountFraction(tier: TierName): number {
  return TIER_BENEFITS[tier].protectionDiscountPercent / 100;
}

/**
 * Protection fee: base USD per protected golfer × count × (1 − tier discount).
 * Rounded to cents.
 */
export function computeProtectionFeeUsd(
  basePerGolferUsd: number,
  protectedCount: number,
  tier: TierName,
): number {
  const n = Math.max(0, Math.floor(protectedCount));
  if (n <= 0) return 0;
  const raw = Math.max(0, basePerGolferUsd) * n * (1 - protectionDiscountFraction(tier));
  return Math.round(raw * 100) / 100;
}

export function tierFromPoints(points: number): TierName {
  const p = Math.max(0, Math.floor(points));
  if (p >= TIER_MIN_POINTS.Platinum) return "Platinum";
  if (p >= TIER_MIN_POINTS.Gold) return "Gold";
  if (p >= TIER_MIN_POINTS.Silver) return "Silver";
  return "Bronze";
}

export function loyaltyPointsFromEntryFee(entryFeeUsd: number): number {
  return Math.floor(Math.max(0, entryFeeUsd) * LOYALTY_POINTS_PER_ENTRY_DOLLAR);
}

export type TierProgress = {
  tier: TierName;
  nextTier: TierName | null;
  /** Progress within the current tier toward the next (0–100). */
  progressPercent: number;
  points: number;
  rangeMin: number;
  rangeMax: number | null;
  pointsToNextTier: number | null;
};

export function getTierProgress(points: number): TierProgress {
  const p = Math.max(0, Math.floor(points));
  const tier = tierFromPoints(p);
  const idx = TIER_ORDER.indexOf(tier);

  if (tier === "Platinum") {
    return {
      tier,
      nextTier: null,
      progressPercent: 100,
      points: p,
      rangeMin: TIER_MIN_POINTS.Platinum,
      rangeMax: null,
      pointsToNextTier: null,
    };
  }

  const nextTier = TIER_ORDER[idx + 1]!;
  const min = TIER_MIN_POINTS[tier];
  const nextMin = TIER_MIN_POINTS[nextTier];
  const span = nextMin - min;
  const pct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((p - min) / span) * 100));

  return {
    tier,
    nextTier,
    progressPercent: pct,
    points: p,
    rangeMin: min,
    rangeMax: nextMin,
    pointsToNextTier: Math.max(0, nextMin - p),
  };
}

/** Overall journey toward Platinum (0–100), linear on point scale. */
export function overallTierJourneyPercent(points: number): number {
  const cap = TIER_MIN_POINTS.Platinum;
  if (cap <= 0) return 100;
  return Math.min(100, (Math.max(0, Math.floor(points)) / cap) * 100);
}
