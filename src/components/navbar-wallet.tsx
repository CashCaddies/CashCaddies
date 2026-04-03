"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { refreshWallet, useWallet } from "@/hooks/use-wallet";
import { FounderBadge } from "@/components/founder-badge";
import { TierProgressBar } from "@/components/tier-progress-bar";
import { formatMoney, tierBadgeClass } from "@/lib/wallet";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";
import { supabase } from "@/lib/supabase";

const QUICK_AMOUNTS = [50, 100, 250, 500] as const;
const RESET_BALANCE = 5000;

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

export function NavbarWallet() {
  const { isReady } = useAuth();
  const { user, wallet, fullUser, loading, error, refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const canAddFunds = Boolean(
    wallet && hasClosedBetaAppAccess({ beta_user: wallet.beta_user, beta_status: wallet.beta_status }, fullUser?.role),
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("click", onDocClick);
      return () => document.removeEventListener("click", onDocClick);
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const applyBalance = useCallback(
    async (nextBalance: number) => {
      if (!supabase || !user) {
        setToast("Not connected.");
        return;
      }
      if (!canAddFunds) {
        setToast("Only approved beta users can add test funds.");
        return;
      }
      setPending(true);
      setToast(null);
      const b = roundUsd(nextBalance);
      if (b < 0) {
        setToast("Balance cannot be negative.");
        setPending(false);
        return;
      }
      /* `wallet_balance` mirrors `account_balance`; update `account_balance` only. */
      const { error: uErr } = await supabase
        .from("profiles")
        .update({
          account_balance: b,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      setPending(false);
      if (uErr) {
        setToast(uErr.message);
        return;
      }
      await refreshWallet();
      setToast("Balance updated");
    },
    [canAddFunds, user],
  );

  const quickAdd = async (amount: number) => {
    if (!wallet) return;
    const current = Number(wallet.wallet_balance ?? wallet.account_balance ?? 0);
    await applyBalance(current + amount);
  };

  const resetBalance = async () => {
    await applyBalance(RESET_BALANCE);
  };

  if (!isReady || !user) {
    return null;
  }

  const hasBetaAccess = hasClosedBetaAppAccess(
    { beta_user: wallet?.beta_user, beta_status: wallet?.beta_status },
    fullUser?.role,
  );
  if (!loading && !hasBetaAccess) {
    return (
      <div className="walletCard relative shrink-0" ref={panelRef}>
        <button
          type="button"
          disabled
          title="Closed beta access required"
          aria-label="Closed beta access required"
          className="navbarWalletTrigger flex w-full cursor-not-allowed items-center gap-1.5 text-left text-sm font-semibold text-slate-400 opacity-60"
        >
          <span className="text-slate-300">Beta Wallet</span>
          <span className="walletAmount">—</span>
        </button>
      </div>
    );
  }

  return (
    <div className="walletCard relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="navbarWalletTrigger flex w-full items-center gap-1.5 text-left text-sm font-semibold text-slate-200 transition-[transform,box-shadow] duration-150 ease-out hover:translate-y-[-1px] motion-reduce:hover:translate-y-0"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="text-slate-200">Beta Wallet</span>
        <span className="walletAmount tabular-nums">
          {loading
            ? "…"
            : wallet
              ? formatMoney(wallet.wallet_balance ?? wallet.account_balance)
              : "—"}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/40"
          role="dialog"
          aria-label="Beta wallet summary"
        >
          {error && <p className="text-xs text-amber-300">{error}</p>}
          {loading && !error && <p className="text-sm text-slate-400">Loading wallet…</p>}
          {!loading && wallet && (
            <>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Current Balance</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {formatMoney(wallet.wallet_balance ?? wallet.account_balance)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-emerald-400/90">Beta Balance</p>
                {wallet.founding_tester === true ? (
                  <p className="mt-3 flex justify-center">
                    <FounderBadge />
                  </p>
                ) : null}
              </div>

              {canAddFunds ? (
                <div className="mt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={pending}
                        onClick={() => void quickAdd(amt)}
                        className="rounded-lg border border-emerald-400 px-3 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {`+$${amt}`}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void resetBalance()}
                    className="w-full rounded-lg border border-yellow-400 px-3 py-2.5 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset to {formatMoney(RESET_BALANCE)}
                  </button>
                  <p className="text-center text-xs text-muted-foreground">Beta funds are for testing only.</p>
                </div>
              ) : null}

              <dl className="mt-4 space-y-3 border-t border-slate-800 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Safety Coverage credit</dt>
                  <dd className="font-semibold tabular-nums text-emerald-200">
                    {formatMoney(wallet.protection_credit_balance ?? 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Site credits</dt>
                  <dd className="font-semibold tabular-nums text-emerald-300">{formatMoney(wallet.site_credits)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Loyalty points</dt>
                  <dd className="font-semibold tabular-nums text-white">{wallet.loyalty_points.toLocaleString()}</dd>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
                  <dt className="text-slate-400">Tier status</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tierBadgeClass(wallet.loyalty_tier)}`}
                    >
                      {wallet.loyalty_tier}
                    </span>
                  </dd>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <TierProgressBar points={wallet.loyalty_points} variant="compact" />
                </div>
              </dl>
            </>
          )}
          {toast ? (
            <p
              className="mt-3 rounded-md border border-emerald-700/30 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300"
              role="status"
            >
              {toast}
            </p>
          ) : null}
          <Link
            href="/wallet"
            className="mt-4 block rounded-md bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-emerald-500"
            onClick={() => setOpen(false)}
          >
            Open wallet
          </Link>
        </div>
      )}
    </div>
  );
}
