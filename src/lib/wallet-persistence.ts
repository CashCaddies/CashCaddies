import type { WalletTransaction, WalletTxType } from "@/lib/wallet-transaction";

/** localStorage key — value is JSON scoped by `userId` inside the payload. */
export const WALLET_BALANCE_STORAGE_KEY = "cashcaddies_wallet_balance";

export const WALLET_TRANSACTIONS_STORAGE_KEY = "cashcaddies_wallet_transactions";

const ENVELOPE_VERSION = 1 as const;

type BalanceEnvelope = {
  v: typeof ENVELOPE_VERSION;
  userId: string;
  balance: number;
};

type TransactionsEnvelope = {
  v: typeof ENVELOPE_VERSION;
  userId: string;
  transactions: WalletTransaction[];
};

const TX_TYPES: ReadonlySet<string> = new Set(["Deposit", "Entry Fee", "Winnings"]);

export function safeWalletNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function readJson(key: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function readPersistedWalletBalance(userId: string): number | null {
  if (!userId) return null;
  const data = readJson(WALLET_BALANCE_STORAGE_KEY);
  if (!data || typeof data !== "object") return null;
  const o = data as Partial<BalanceEnvelope>;
  if (o.v !== ENVELOPE_VERSION || typeof o.userId !== "string" || o.userId !== userId) return null;
  const b = safeWalletNumber(o.balance);
  return b;
}

export function writePersistedWalletBalance(userId: string, balance: number): void {
  if (!userId) return;
  const b = safeWalletNumber(balance);
  const payload: BalanceEnvelope = { v: ENVELOPE_VERSION, userId, balance: b };
  writeJson(WALLET_BALANCE_STORAGE_KEY, payload);
}

function isValidTransaction(row: unknown): row is WalletTransaction {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return false;
  if (typeof r.date !== "string" || !r.date) return false;
  if (typeof r.type !== "string" || !TX_TYPES.has(r.type)) return false;
  if (r.status !== "Completed") return false;
  const raw = r.amount;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return false;
  return true;
}

export function readPersistedWalletTransactions(userId: string): WalletTransaction[] | null {
  if (!userId) return null;
  const data = readJson(WALLET_TRANSACTIONS_STORAGE_KEY);
  if (!data || typeof data !== "object") return null;
  const o = data as Partial<TransactionsEnvelope>;
  if (o.v !== ENVELOPE_VERSION || typeof o.userId !== "string" || o.userId !== userId) return null;
  if (!Array.isArray(o.transactions)) return null;
  const cleaned: WalletTransaction[] = [];
  for (const row of o.transactions) {
    if (!isValidTransaction(row)) continue;
    cleaned.push({
      id: row.id,
      date: row.date,
      type: row.type as WalletTxType,
      amount: safeWalletNumber(typeof row.amount === "number" ? row.amount : Number(row.amount)),
      status: "Completed",
    });
  }
  return cleaned;
}

export function writePersistedWalletTransactions(userId: string, transactions: WalletTransaction[]): void {
  if (!userId) return;
  const payload: TransactionsEnvelope = {
    v: ENVELOPE_VERSION,
    userId,
    transactions: transactions.map((t) => ({
      ...t,
      amount: safeWalletNumber(t.amount),
    })),
  };
  writeJson(WALLET_TRANSACTIONS_STORAGE_KEY, payload);
}

/** Prepends one row (e.g. contest entry) to persisted history. Safe if the user has never opened /wallet. */
export function appendPersistedWalletTransaction(userId: string, tx: WalletTransaction): void {
  if (!userId) return;
  const cur = readPersistedWalletTransactions(userId);
  const list = cur ?? [];
  writePersistedWalletTransactions(userId, [
    {
      ...tx,
      amount: safeWalletNumber(tx.amount),
    },
    ...list,
  ]);
}
