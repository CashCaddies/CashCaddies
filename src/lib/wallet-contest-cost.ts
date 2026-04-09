export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Matches server paid entry billing: user pays entry fee only. */
export function totalContestEntryChargeUsd(entryFeeUsd: number, loyaltyPoints: number): number {
  void loyaltyPoints;
  const fee = roundMoney2(Math.max(0, entryFeeUsd));
  return roundMoney2(fee);
}
