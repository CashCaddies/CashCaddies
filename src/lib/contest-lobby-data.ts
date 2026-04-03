/** DFS salary cap (lineup builder). */
export const SALARY_CAP = 50000;

/** CashCaddies Safety Coverage add-on (USD) shown at lineup entry. */
export const CASHCADDIE_PROTECTION_FEE_USD = 1;

/** Parse "$5" -> 5 for totals (0 if unknown). */
export function parseEntryFeeUsd(entryFee: string): number {
  const n = Number.parseFloat(entryFee.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Display name, fee, and status for a lineup `contest_id` when contest row is not joined. */
export function getContestDisplay(contestId: string | null | undefined) {
  if (contestId == null || contestId === "") {
    return {
      name: "Saved draft",
      entryFee: "—",
      status: "N/A",
      feeNumber: 0,
    };
  }
  if (contestId === "default") {
    return {
      name: "Practice / draft",
      entryFee: "—",
      status: "N/A",
      feeNumber: 0,
    };
  }
  return {
    name: `Contest (${contestId})`,
    entryFee: "—",
    status: "Unknown",
    feeNumber: 0,
  };
}
