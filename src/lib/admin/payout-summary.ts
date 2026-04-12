import type { PayoutHistoryRow } from "./get-payout-history";

export type PayoutRowSummary = {
  totalRows: number;
  totalPaid: number;
  totalAmount: number;
};

/** Aggregate stats for the current payout row list (e.g. after filter). */
export function getPayoutRowSummary(data: PayoutHistoryRow[]): PayoutRowSummary {
  const totalPaid = data.filter((d) => d.paid).length;
  const totalAmount = data.reduce(
    (sum: number, d) => sum + Number(d.winnings_usd || 0),
    0,
  );

  return {
    totalRows: data.length,
    totalPaid,
    totalAmount,
  };
}
