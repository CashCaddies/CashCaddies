"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TransactionTable } from "@/components/transaction-table";
import { WalletModal } from "@/components/wallet-modal";
import { refreshWallet, useWallet } from "@/hooks/use-wallet";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";
import {
  readPersistedWalletBalance,
  safeWalletNumber,
  writePersistedWalletBalance,
  readPersistedWalletTransactions,
  writePersistedWalletTransactions,
} from "@/lib/wallet-persistence";
import {
  CONTEST_PRIZE_TRANSACTION_TYPE,
  ENTRY_PROTECTION_REFUND_TRANSACTION_TYPE,
  contestPrizeRowToWalletTransaction,
  entryProtectionRefundRowToWalletTransaction,
  mergeWalletTransactionsWithContestPrizes,
  sessionStoragePrizeAnnounceKey,
} from "@/lib/contest-settlement";
import { dispatchWalletWinnings, WALLET_WINNINGS_EVENT } from "@/lib/wallet-bankroll-events";
import {
  createMockWalletTransactions,
  newDepositTransaction,
  type WalletTransaction,
} from "@/lib/wallet-transaction";
import { formatMoney } from "@/lib/wallet";
import { supabase } from "@/lib/supabase";

const ADD_AMOUNTS = [50, 100, 250, 500] as const;
const RESET_BALANCE = 5000;

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function WalletLoadingSpinner() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-yellow-500/25 border-t-yellow-400"
        aria-hidden
      />
      <p className="text-sm text-slate-400">Loading wallet…</p>
    </div>
  );
}

export default function WalletPage() {
  const { user, wallet, fullUser, loading, error } = useWallet();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [persistReady, setPersistReady] = useState(false);
  const [balanceWinFlash, setBalanceWinFlash] = useState(false);

  const canAddFunds = Boolean(
    wallet &&
      hasClosedBetaAppAccess({ beta_user: wallet.beta_user, beta_status: wallet.beta_status }, fullUser?.role),
  );

  const displayBalance = useMemo(() => {
    if (loading) return 0;
    if (wallet) {
      return safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance);
    }
    if (user?.id && typeof window !== "undefined") {
      const stored = readPersistedWalletBalance(user.id);
      if (stored !== null) return stored;
    }
    return 0;
  }, [loading, wallet, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setWalletTransactions([]);
      setPersistReady(false);
      return;
    }
    if (typeof window === "undefined") return;

    let cancelled = false;

    void (async () => {
      const loaded = readPersistedWalletTransactions(user.id);
      let local: WalletTransaction[];
      if (loaded && loaded.length > 0) {
        local = loaded;
      } else {
        local = createMockWalletTransactions();
        writePersistedWalletTransactions(user.id, local);
      }

      let dbPrizes: WalletTransaction[] = [];
      let dbEntryProtection: WalletTransaction[] = [];
      if (supabase) {
        const { data: rows } = await supabase
          .from("transactions")
          .select("id, amount, type, created_at")
          .eq("user_id", user.id)
          .eq("type", CONTEST_PRIZE_TRANSACTION_TYPE)
          .order("created_at", { ascending: false })
          .limit(100);

        type PrizeRow = { id: string; amount: unknown; type: string; created_at: string };
        dbPrizes = (rows ?? [])
          .filter((r: unknown): r is PrizeRow => {
            if (!r || typeof r !== "object") return false;
            const o = r as Record<string, unknown>;
            return typeof o.id === "string" && Boolean(o.id);
          })
          .map((r: PrizeRow) =>
            contestPrizeRowToWalletTransaction({
              id: r.id,
              amount: r.amount as number | string | null,
              type: r.type,
              created_at: r.created_at,
            }),
          );

        const { data: protRows } = await supabase
          .from("transactions")
          .select("id, amount, type, created_at")
          .eq("user_id", user.id)
          .eq("type", ENTRY_PROTECTION_REFUND_TRANSACTION_TYPE)
          .order("created_at", { ascending: false })
          .limit(100);

        dbEntryProtection = (protRows ?? [])
          .filter((r: unknown): r is PrizeRow => {
            if (!r || typeof r !== "object") return false;
            const o = r as Record<string, unknown>;
            return typeof o.id === "string" && Boolean(o.id);
          })
          .map((r: PrizeRow) =>
            entryProtectionRefundRowToWalletTransaction({
              id: r.id,
              amount: r.amount as number | string | null,
              type: r.type,
              created_at: r.created_at,
            }),
          );

        if (dbPrizes.length > 0 || dbEntryProtection.length > 0) {
          await refreshWallet();
        }
      }

      let merged = mergeWalletTransactionsWithContestPrizes(local, dbPrizes);
      merged = mergeWalletTransactionsWithContestPrizes(merged, dbEntryProtection);

      const key = sessionStoragePrizeAnnounceKey(user.id);
      let announced: Set<string>;
      try {
        const raw = sessionStorage.getItem(key);
        announced = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        announced = new Set();
      }

      let newSum = 0;
      for (const t of dbPrizes) {
        if (!announced.has(t.id)) {
          announced.add(t.id);
          newSum += t.amount;
        }
      }
      if (newSum > 0) {
        try {
          sessionStorage.setItem(key, JSON.stringify([...announced]));
        } catch {
          /* ignore */
        }
        dispatchWalletWinnings(newSum);
      }

      if (!cancelled) {
        setWalletTransactions(merged);
        setPersistReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !persistReady) return;
    writePersistedWalletTransactions(user.id, walletTransactions);
  }, [user?.id, walletTransactions, persistReady]);

  useEffect(() => {
    if (!user?.id || loading) return;
    if (wallet) {
      writePersistedWalletBalance(
        user.id,
        safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance),
      );
    }
  }, [user?.id, loading, wallet]);

  useEffect(() => {
    function onWin() {
      setBalanceWinFlash(true);
      window.setTimeout(() => setBalanceWinFlash(false), 900);
    }
    window.addEventListener(WALLET_WINNINGS_EVENT, onWin);
    return () => window.removeEventListener(WALLET_WINNINGS_EVENT, onWin);
  }, []);

  const applyBalance = useCallback(
    async (nextBalance: number): Promise<boolean> => {
      if (!supabase || !user) {
        setLocalError("Not connected.");
        return false;
      }
      if (!canAddFunds) {
        setLocalError("Only beta users can add test funds. Admins can always add funds.");
        return false;
      }
      setBusy(true);
      setLocalError(null);
      const b = roundUsd(nextBalance);
      if (b < 0) {
        setLocalError("Balance cannot be negative.");
        setBusy(false);
        return false;
      }
      const { error: uErr } = await supabase
        .from("profiles")
        .update({
          account_balance: b,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      setBusy(false);
      if (uErr) {
        setLocalError(uErr.message);
        return false;
      }
      writePersistedWalletBalance(user.id, b);
      await refreshWallet();
      return true;
    },
    [canAddFunds, user],
  );

  const addAmount = async (amount: number) => {
    if (!wallet || !user) return;
    const current = safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance);
    await applyBalance(current + amount);
  };

  const resetBalance = async () => {
    await applyBalance(RESET_BALANCE);
  };

  const handleModalDeposit = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!wallet || !user) return false;
      const current = safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance);
      const ok = await applyBalance(current + amount);
      if (ok) {
        setWalletTransactions((prev) => [newDepositTransaction(amount), ...prev]);
      }
      return ok;
    },
    [applyBalance, user, wallet],
  );

  if (!user) {
    if (loading) {
      return <WalletLoadingSpinner />;
    }
    return (
      <p className="p-6 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to manage your wallet.
      </p>
    );
  }

  if (loading || !persistReady) {
    return <WalletLoadingSpinner />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <WalletModal open={depositOpen} onClose={() => setDepositOpen(false)} onConfirm={handleModalDeposit} busy={busy} />

      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-slate-200"
      >
        <span aria-hidden>←</span>
        Back to Dashboard
      </Link>

      <header className="mt-8">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Wallet</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your balance and view activity.</p>
      </header>

      {error ? (
        <p className="mt-6 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}
      {localError ? (
        <p className="mt-6 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-100">{localError}</p>
      ) : null}

      <section className="mt-10 rounded-2xl border border-yellow-500/20 bg-slate-900/70 p-8 shadow-[0_0_48px_rgba(212,175,55,0.08)]">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current balance</p>
        <p
          className={`walletPageBalance mt-3 text-center text-5xl font-bold tabular-nums tracking-tight sm:text-6xl${balanceWinFlash ? " walletPageBalanceWin" : ""}`}
        >
          {formatMoney(displayBalance)}
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">Beta funds have no cash value.</p>
      </section>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Deposit</p>
        <p className="mt-1 text-sm text-slate-400">
          {canAddFunds
            ? "Add funds to your bankroll (simulated — no card charge yet)."
            : "Deposits unlock when your beta access is approved."}
        </p>
        <button
          type="button"
          disabled={busy || !canAddFunds}
          onClick={() => setDepositOpen(true)}
          className="mt-4 w-full rounded-xl border border-yellow-500/55 bg-gradient-to-b from-yellow-500/35 to-yellow-700/20 px-5 py-3.5 text-base font-bold tracking-wide text-[#fff8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_24px_rgba(212,175,55,0.12)] transition hover:border-yellow-400/70 hover:from-yellow-500/45 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:min-w-[200px]"
        >
          Deposit Funds
        </button>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled
            title="Withdrawals are not available yet."
            className="cursor-not-allowed rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3.5 text-sm font-semibold text-slate-500 opacity-60"
          >
            Withdraw
          </button>
        </div>
      </div>

      {canAddFunds ? (
        <div className="mt-8 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Beta quick add</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ADD_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={busy}
                onClick={() => void addAmount(amt)}
                className="rounded-xl border border-emerald-600/50 bg-emerald-950/50 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +${amt}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void resetBalance()}
            className="w-full rounded-xl border border-amber-500/45 bg-amber-950/35 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/55 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset to ${RESET_BALANCE}
          </button>
        </div>
      ) : null}

      {!canAddFunds ? (
        <p className="mt-6 text-sm text-slate-500">
          Test funding is available to approved beta users. Site admins can add funds at any time.
        </p>
      ) : null}

      <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-950/50 p-6 shadow-[0_0_32px_rgba(0,0,0,0.25)]">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Transaction history</h2>
        <p className="mt-1 text-xs text-slate-600">
          History is saved on this device; balance syncs with your CashCaddies profile when connected.
        </p>
        <div className="mt-6">
          <TransactionTable transactions={walletTransactions} />
        </div>
      </section>
    </div>
  );
}
