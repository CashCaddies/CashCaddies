"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { confirmLobbyContestEntry, precheckContestEntryCapacity } from "@/app/lobby/actions";
import { InsufficientFundsModal } from "@/components/insufficient-funds-modal";
import { useAuth } from "@/contexts/auth-context";
import { refreshWallet, useWallet } from "@/hooks/use-wallet";
import { dispatchWalletBankrollFlash } from "@/lib/wallet-bankroll-events";
import {
  appendPersistedWalletTransaction,
  safeWalletNumber,
  writePersistedWalletBalance,
} from "@/lib/wallet-persistence";
import { totalContestEntryChargeUsd, roundMoney2 } from "@/lib/wallet-contest-cost";
import { newEntryFeeTransaction } from "@/lib/wallet-transaction";
import { formatMoney } from "@/lib/wallet";
import { supabase } from "@/lib/supabase/client";

type Props = {
  contestId: string;
  contestName: string;
  entryFeeUsd: number;
  /** `contests.max_entries` (global cap). */
  contestMaxEntries: number;
  /** Current total entries for this contest (e.g. from lobby row). */
  contestEntryCount: number;
  /** `contests.status` — Enter is only active when `"filling"` and below global capacity. */
  contestStatus: string | null | undefined;
  /** From `contests.max_entries_per_user`; null means effectively unlimited (matches eligibility). */
  maxEntriesPerUser?: number | null;
};

type DraftRow = { id: string; created_at: string; total_salary: number };

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

function effectiveMaxPerUser(maxEntriesPerUser: number | null | undefined): number {
  if (maxEntriesPerUser == null) {
    return 999999;
  }
  const n = Math.floor(Number(maxEntriesPerUser));
  return Number.isFinite(n) && n >= 0 ? n : 999999;
}

function labelForClosedContestStatus(status: string): string {
  const s = status.trim().toLowerCase();
  switch (s) {
    case "locked":
      return "LOCKED";
    case "live":
      return "LIVE";
    case "complete":
      return "COMPLETE";
    case "settled":
      return "SETTLED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    default:
      return s ? s.toUpperCase() : "—";
  }
}

export function LobbyEnterButton({
  contestId,
  contestName,
  entryFeeUsd,
  contestMaxEntries,
  contestEntryCount,
  contestStatus,
  maxEntriesPerUser = null,
}: Props) {
  const router = useRouter();
  const { user: authUser, isReady } = useAuth();
  const { wallet } = useWallet();
  const [userEntryCount, setUserEntryCount] = useState<number | null>(null);
  const [entryCountReady, setEntryCountReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [capacityModalOpen, setCapacityModalOpen] = useState(false);
  const [capacityModalMessage, setCapacityModalMessage] = useState<string | null>(null);
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [insufficientCtx, setInsufficientCtx] = useState<{ account_balance: number; required: number } | null>(
    null,
  );
  const enterFlowInFlight = useRef(false);
  /** Bumps after successful entry so `contest_entries` count refetches. */
  const [entriesRefreshTick, setEntriesRefreshTick] = useState(0);

  const maxPer = useMemo(() => effectiveMaxPerUser(maxEntriesPerUser), [maxEntriesPerUser]);

  const totalToEnterUsd = useMemo(() => {
    if (!wallet) return null;
    return totalContestEntryChargeUsd(entryFeeUsd, Number(wallet.loyalty_points ?? 0));
  }, [wallet, entryFeeUsd]);
  const maxGlobal = Math.max(1, Math.floor(Number(contestMaxEntries)));
  const normalizedStatus = String(contestStatus ?? "")
    .trim()
    .toLowerCase();
  const isFilling = normalizedStatus === "filling";
  const atGlobalCapacity = contestEntryCount >= maxGlobal;
  const canEnter = isFilling && contestEntryCount < maxGlobal;

  const userAtLimit =
    authUser != null &&
    entryCountReady &&
    userEntryCount != null &&
    userEntryCount >= maxPer;

  useEffect(() => {
    if (!isReady || !authUser) {
      setUserEntryCount(null);
      setEntryCountReady(true);
      return;
    }
    const sb = supabase;
    if (!sb) {
      setUserEntryCount(null);
      setEntryCountReady(true);
      return;
    }
    let cancelled = false;
    setEntryCountReady(false);
    void (async () => {
      const { count, error } = await sb
        .from("contest_entries")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .eq("user_id", authUser.id);
      if (cancelled) {
        return;
      }
      setUserEntryCount(error ? 0 : (count ?? 0));
      setEntryCountReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, authUser, contestId, entriesRefreshTick]);

  const feeLabel = Number.isFinite(entryFeeUsd)
    ? `$${entryFeeUsd.toLocaleString(undefined, {
        minimumFractionDigits: entryFeeUsd % 1 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`
    : "—";

  const countBusy = Boolean(authUser && !entryCountReady);

  const onEnterContest = useCallback(async () => {
    if (!canEnter) {
      setLoading(false);
      enterFlowInFlight.current = false;
      return;
    }
    if (userAtLimit) {
      setLoading(false);
      enterFlowInFlight.current = false;
      return;
    }
    try {
      const sb = supabase;
      if (!sb) {
        setError("Missing Supabase configuration.");
        return;
      }

      if (!isReady) {
        return;
      }

      if (!authUser) {
        router.push("/login");
        return;
      }

      const pre = await precheckContestEntryCapacity(contestId);
      if (!pre.ok) {
        setCapacityModalMessage(pre.error);
        setCapacityModalOpen(true);
        return;
      }

      const user = authUser;
      const base = () =>
        sb
          .from("lineups")
          .select("id, created_at, total_salary")
          .eq("user_id", user.id)
          .is("contest_entry_id", null)
          .order("created_at", { ascending: false });
      const [forContest, unassigned] = await Promise.all([
        base().eq("contest_id", contestId),
        base().is("contest_id", null),
      ]);

      if (forContest.error) {
        setError(forContest.error.message);
        return;
      }
      if (unassigned.error) {
        setError(unassigned.error.message);
        return;
      }

      const byId = new Map<string, DraftRow>();
      for (const r of [...(forContest.data ?? []), ...(unassigned.data ?? [])]) {
        byId.set(r.id, r as DraftRow);
      }
      const rows = [...byId.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (rows.length === 0) {
        router.push(`/lineup?contest=${encodeURIComponent(contestId)}`);
        return;
      }

      setDrafts(rows);
      setSelectedId(rows[0]?.id ?? null);
      setPending(false);
      setModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      enterFlowInFlight.current = false;
    }
  }, [authUser, canEnter, contestId, isReady, router, userAtLimit]);

  function handleEnterClick(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (loading || enterFlowInFlight.current) {
      return;
    }
    if (!canEnter || userAtLimit || countBusy) {
      return;
    }
    enterFlowInFlight.current = true;
    setError(null);
    setSuccess(null);
    setLoading(true);
    void onEnterContest();
  }

  async function onConfirm() {
    if (pending) {
      return;
    }
    if (!selectedId) {
      setError("Select a lineup.");
      return;
    }
    if (!authUser) {
      return;
    }
    if (!wallet) {
      setError("Loading your wallet… try again in a moment.");
      return;
    }
    const totalDue = totalContestEntryChargeUsd(entryFeeUsd, Number(wallet.loyalty_points ?? 0));
    const accountBalanceBefore = safeWalletNumber(wallet.wallet_balance ?? wallet.account_balance);
    if (accountBalanceBefore < totalDue) {
      setInsufficientCtx({ account_balance: accountBalanceBefore, required: totalDue });
      setInsufficientOpen(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await confirmLobbyContestEntry({ contestId, lineupId: selectedId });
      if (result.ok) {
        appendPersistedWalletTransaction(authUser.id, newEntryFeeTransaction(totalDue));
        writePersistedWalletBalance(authUser.id, roundMoney2(Math.max(0, accountBalanceBefore - totalDue)));
        setModalOpen(false);
        setSuccess(result.message);
        setEntriesRefreshTick((t) => t + 1);
        await refreshWallet();
        dispatchWalletBankrollFlash();
        router.refresh();
        return;
      }
      setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setPending(false);
  }

  const buttonDisabled = loading || !canEnter || userAtLimit || countBusy;
  const mutedAppearance = !canEnter || userAtLimit;
  const buttonLabel =
    loading || countBusy
      ? "Loading…"
      : atGlobalCapacity
        ? "FULL"
        : userAtLimit && isFilling
          ? "ENTERED"
          : !canEnter
            ? labelForClosedContestStatus(normalizedStatus)
            : "ENTER CONTEST";

  return (
    <div className="relative z-10 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleEnterClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
          }
        }}
        disabled={buttonDisabled}
        title={
          atGlobalCapacity
            ? "Contest is full"
            : !canEnter
              ? "Contest is not open for entries."
              : userAtLimit
                ? "Already entered"
                : undefined
        }
        className={`relative z-10 inline-flex min-w-[7rem] items-center justify-center gap-2 rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-wide shadow-sm sm:min-w-[8.5rem] sm:text-xs ${
          mutedAppearance
            ? "cursor-not-allowed border-[#3d4550] bg-[#2a3039] text-[#8b98a5]"
            : "cursor-pointer border-[#2d7a3a] bg-[#1f8a3b] text-white hover:bg-[#249544] active:bg-[#1c7a34] disabled:cursor-not-allowed disabled:opacity-50"
        }`}
      >
        {(loading || countBusy) && canEnter && !userAtLimit ? <InlineSpinner /> : null}
        {buttonLabel}
      </button>
      {error && !modalOpen && !capacityModalOpen && (
        <p className="max-w-[14rem] text-right text-[10px] font-medium leading-snug text-amber-200" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="max-w-[16rem] text-right text-[11px] font-medium leading-snug text-[#53d769]" role="status">
          {success}
        </p>
      )}

      {insufficientCtx ? (
        <InsufficientFundsModal
          open={insufficientOpen}
          onClose={() => {
            setInsufficientOpen(false);
            setInsufficientCtx(null);
          }}
          accountBalanceUsd={insufficientCtx.account_balance}
          requiredUsd={insufficientCtx.required}
          contestName={contestName}
        />
      ) : null}

      {capacityModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lobby-capacity-title"
          onClick={() => {
            setCapacityModalOpen(false);
            setCapacityModalMessage(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-amber-500/40 bg-[#141920] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lobby-capacity-title" className="text-lg font-bold text-white">
              Cannot enter contest
            </h2>
            <p className="mt-4 text-base font-semibold leading-snug text-white" role="alert">
              {capacityModalMessage ?? "Entry is not available for this contest."}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="rounded border border-[#2d7a3a] bg-[#1f8a3b] px-4 py-2 text-sm font-bold text-white hover:bg-[#249544]"
                onClick={() => {
                  setCapacityModalOpen(false);
                  setCapacityModalMessage(null);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lobby-enter-title"
          onClick={() => {
            if (!pending) {
              setModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[#2a3039] bg-[#141920] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="lobby-enter-title" className="text-lg font-bold text-white">
              Choose a lineup
            </h2>
            <p className="mt-1 text-sm text-[#8b98a5]">
              <Link
                href={`/contest/${encodeURIComponent(contestId)}`}
                className="font-medium text-[#c5cdd5] hover:text-[#7ab8ff] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {contestName}
              </Link>
            </p>
            <p className="mt-2 text-sm text-[#c5cdd5]">
              Entry fee: <span className="font-semibold text-white">{feeLabel}</span>
            </p>
            {totalToEnterUsd != null ? (
              <p className="mt-1 text-sm text-amber-100/90">
                Total to enter (incl. safety coverage):{" "}
                <span className="font-bold text-white">{formatMoney(totalToEnterUsd)}</span>
              </p>
            ) : null}
            <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
              {drafts.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2.5 has-[:checked]:border-[#2d7a3a]">
                    <input
                      type="radio"
                      name={`lineup-${contestId}`}
                      checked={selectedId === d.id}
                      onChange={() => {
                        setSelectedId(d.id);
                        setError(null);
                      }}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[#e8ecf0]">
                      Salary ${d.total_salary.toLocaleString()}
                      <span className="ml-2 text-xs text-[#6b7684]">
                        {new Date(d.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {error && (
              <p className="mt-3 text-sm text-amber-200" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-[#3d4550] px-4 py-2 text-sm font-semibold text-[#c5cdd5] hover:bg-[#1c2128]"
                disabled={pending}
                onClick={() => {
                  setModalOpen(false);
                  setError(null);
                  setPending(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !selectedId || !wallet}
                className="inline-flex items-center justify-center gap-2 rounded border border-[#2d7a3a] bg-[#1f8a3b] px-4 py-2 text-sm font-bold text-white hover:bg-[#249544] disabled:opacity-50"
                onClick={() => void onConfirm()}
              >
                {pending ? (
                  <>
                    <InlineSpinner className="h-4 w-4 shrink-0 animate-spin text-white" />
                    Confirming…
                  </>
                ) : (
                  "Confirm entry"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
