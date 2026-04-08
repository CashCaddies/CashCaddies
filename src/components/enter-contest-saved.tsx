"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { enterContestWithSavedLineup } from "@/app/lineup/actions";
import { InsufficientFundsModal } from "@/components/insufficient-funds-modal";
import type { DraftLineupPlayer } from "@/lib/contest-enter";
import { CASHCADDIE_PROTECTION_FEE_USD } from "@/lib/contest-lobby-data";
import { computeProtectionFeeUsd, tierFromPoints, type TierName, TIER_BENEFITS } from "@/lib/loyalty";
import { refreshWallet, useWallet } from "@/hooks/use-wallet";
import { dispatchWalletBankrollFlash } from "@/lib/wallet-bankroll-events";
import {
  appendPersistedWalletTransaction,
  safeWalletNumber,
  writePersistedWalletBalance,
} from "@/lib/wallet-persistence";
import { roundMoney2 } from "@/lib/wallet-contest-cost";
import { newEntryFeeTransaction } from "@/lib/wallet-transaction";

type Props = {
  contestId: string;
  lineupId: string;
  players: DraftLineupPlayer[];
  /** Loyalty tier from server (entry page) */
  tier: TierName;
  entryFeeUsd: number;
  lineupLocked?: boolean;
  /** Server: cannot add another entry (e.g. per-user max); disables Enter. */
  payEntryBlockedBanner?: string | null;
};

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function InlineSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-3.5 w-3.5 shrink-0 animate-spin text-current"}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export function EnterContestWithSavedLineup({
  contestId,
  lineupId,
  players,
  tier,
  entryFeeUsd,
  lineupLocked = false,
  payEntryBlockedBanner = null,
}: Props) {
  const router = useRouter();
  const { wallet, user } = useWallet();
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientCtx, setInsufficientCtx] = useState<{ balance: number; required: number } | null>(null);
  const effectiveTier = useMemo(() => {
    if (wallet) return tierFromPoints(wallet.loyalty_points);
    return tier;
  }, [wallet, tier]);
  const discountPct = TIER_BENEFITS[effectiveTier].protectionDiscountPercent;

  const [error, setError] = useState<string | null>(null);
  const [poolSuccess, setPoolSuccess] = useState<string | null>(null);
  const [enterSubmitting, setEnterSubmitting] = useState(false);

  const protectionFee = useMemo(
    () => computeProtectionFeeUsd(CASHCADDIE_PROTECTION_FEE_USD, 1, effectiveTier),
    [effectiveTier],
  );
  const totalDue = entryFeeUsd + protectionFee;

  function onEnter() {
    if (lineupLocked) {
      setError("Contest started — lineups locked");
      return;
    }
    if (payEntryBlockedBanner) {
      setError(payEntryBlockedBanner);
      return;
    }
    if (players.length !== 6) {
      setError("Lineup must have 6 golfers.");
      return;
    }
    if (!user || !wallet) {
      setError("Loading your wallet… try again in a moment.");
      return;
    }
    const balanceBefore = safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance);
    if (balanceBefore < totalDue) {
      setInsufficientCtx({ balance: balanceBefore, required: totalDue });
      setInsufficientOpen(true);
      return;
    }
    setError(null);
    setPoolSuccess(null);
    setEnterSubmitting(true);
    void (async () => {
      try {
        const result = await enterContestWithSavedLineup({
          contestId,
          lineupId,
        });
        if (result.ok) {
          appendPersistedWalletTransaction(user.id, newEntryFeeTransaction(totalDue));
          writePersistedWalletBalance(user.id, roundMoney2(Math.max(0, balanceBefore - totalDue)));
          await refreshWallet();
          dispatchWalletBankrollFlash();
          if (result.safetyContributionUsd > 0) {
            setPoolSuccess(`You contributed $${result.safetyContributionUsd.toFixed(2)} to the Safety Pool.`);
            window.setTimeout(() => {
              router.push("/dashboard/lineups");
              router.refresh();
            }, 2200);
          } else {
            router.push("/dashboard/lineups");
            router.refresh();
          }
          return;
        }
        const msg = result.error?.trim() || "Could not enter contest. Please try again.";
        setError(msg);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not enter contest. Please try again.");
      }
      setEnterSubmitting(false);
    })();
  }

  const rosterLocked = lineupLocked;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 sm:max-w-md sm:items-end">
      {insufficientCtx ? (
        <InsufficientFundsModal
          open={insufficientOpen}
          onClose={() => {
            setInsufficientOpen(false);
            setInsufficientCtx(null);
          }}
          balanceUsd={insufficientCtx.balance}
          requiredUsd={insufficientCtx.required}
        />
      ) : null}

      <div className="w-full rounded-lg border border-[#2a3039] bg-[#0f1419] p-3 text-left">
        <div className="text-xs text-[#8b98a5]">
          <div className="flex justify-between tabular-nums">
            <span>Entry</span>
            <span className="text-[#c5cdd5]">{formatMoney(entryFeeUsd)}</span>
          </div>
          <div className="mt-1 flex justify-between tabular-nums">
            <span>CashCaddies Safety Coverage ({effectiveTier} tier{discountPct > 0 ? ` · ${discountPct}% off` : ""})</span>
            <span className="text-[#53d769]">{formatMoney(protectionFee)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[#2a3039] pt-2 font-bold text-white">
            <span>Total</span>
            <span>{formatMoney(totalDue)}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onEnter}
        disabled={enterSubmitting || rosterLocked || Boolean(payEntryBlockedBanner)}
        title={payEntryBlockedBanner ?? (rosterLocked ? "Contest started — lineups locked" : undefined)}
        className="inline-flex min-h-[2.5rem] w-full min-w-[10rem] items-center justify-center gap-2 rounded border border-[#2d7a3a] bg-[#1f8a3b] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#249544] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {enterSubmitting ? (
          <>
            <InlineSpinner className="h-3.5 w-3.5 shrink-0 animate-spin text-white" />
            Entering…
          </>
        ) : (
          "Enter contest"
        )}
      </button>
      {poolSuccess ? (
        <div
          role="status"
          className="w-full rounded border border-emerald-500/40 bg-emerald-950/35 px-3 py-2.5 text-left text-sm font-semibold text-emerald-200 sm:max-w-md"
        >
          {poolSuccess}
        </div>
      ) : null}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full rounded border border-amber-500/50 bg-amber-950/40 px-3 py-2 text-left text-xs font-medium text-amber-100 sm:max-w-[280px]"
        >
          {error}
        </div>
      )}
    </div>
  );
}
