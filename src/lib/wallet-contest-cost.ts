import { CASHCADDIE_PROTECTION_FEE_USD } from "@/lib/contest-lobby-data";
import { computeProtectionFeeUsd, tierFromPoints } from "@/lib/loyalty";

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Matches server `confirmLobbyContestEntry` / paid entry: entry fee + safety coverage (1 golfer). */
export function totalContestEntryChargeUsd(entryFeeUsd: number, loyaltyPoints: number): number {
  const fee = roundMoney2(Math.max(0, entryFeeUsd));
  const tier = tierFromPoints(Math.max(0, Math.floor(loyaltyPoints)));
  const protection = computeProtectionFeeUsd(CASHCADDIE_PROTECTION_FEE_USD, 1, tier);
  return roundMoney2(fee + protection);
}
