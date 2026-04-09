export type WalletTxType = "Deposit" | "Entry Fee" | "Entry Protection" | "Winnings";

export type WalletTransaction = {
  id: string;
  date: string;
  type: WalletTxType;
  /** Positive for deposits and winnings; negative for entry fees. */
  amount: number;
  status: "Completed";
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createMockWalletTransactions(): WalletTransaction[] {
  const now = Date.now();
  return [
    {
      id: "sample-deposit",
      date: new Date(now - 6 * 86400000).toISOString(),
      type: "Deposit",
      amount: 100,
      status: "Completed",
    },
    {
      id: "sample-entry",
      date: new Date(now - 4 * 86400000).toISOString(),
      type: "Entry Fee",
      amount: -20,
      status: "Completed",
    },
    {
      id: "sample-winnings",
      date: new Date(now - 2 * 86400000).toISOString(),
      type: "Winnings",
      amount: 55,
      status: "Completed",
    },
  ];
}

export function newDepositTransaction(amount: number): WalletTransaction {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dep-${Date.now()}`,
    date: new Date().toISOString(),
    type: "Deposit",
    amount: round2(amount),
    status: "Completed",
  };
}

/** Bankroll debit for contest entry (entry fee only). */
export function newEntryFeeTransaction(totalCashDebitUsd: number): WalletTransaction {
  const debit = round2(-Math.abs(totalCashDebitUsd));
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}`,
    date: new Date().toISOString(),
    type: "Entry Fee",
    amount: debit,
    status: "Completed",
  };
}

/** Contest prize credited to wallet (positive amount). */
export function newWinningsTransaction(amountUsd: number, at: Date = new Date()): WalletTransaction {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `win-${Date.now()}`,
    date: at.toISOString(),
    type: "Winnings",
    amount: round2(Math.abs(amountUsd)),
    status: "Completed",
  };
}
