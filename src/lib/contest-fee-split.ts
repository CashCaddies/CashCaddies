export const ENTRY_PRIZE_POOL_FRACTION = 0.9;
export const ENTRY_PROTECTION_FUND_FRACTION = 0.05;
export const ENTRY_PLATFORM_FEE_FRACTION = 0.05;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function splitEntryFeeUsd(entryFeeUsd: number): {
  prizePoolAmount: number;
  protectionAmount: number;
  websiteFee: number;
} {
  const fee = round2(Math.max(0, entryFeeUsd));
  return {
    prizePoolAmount: round2(fee * ENTRY_PRIZE_POOL_FRACTION),
    protectionAmount: round2(fee * ENTRY_PROTECTION_FUND_FRACTION),
    websiteFee: round2(fee * ENTRY_PLATFORM_FEE_FRACTION),
  };
}
