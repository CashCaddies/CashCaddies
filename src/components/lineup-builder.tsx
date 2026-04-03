"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { editContestEntryLineup, saveLineupDraft, submitLineup } from "@/app/lineup/actions";
import { refreshWallet } from "@/hooks/use-wallet";
import { useWallet } from "@/hooks/use-wallet";
import type { GolferRow } from "@/lib/golfers";
import { LATE_SWAP_HEADER_NOTICE, playerSlotLockCountdownLabel } from "@/lib/late-swap";
import { computeProtectionFeeUsd, tierFromPoints, TIER_BENEFITS } from "@/lib/loyalty";
import type { DraftLineupEditorData } from "@/lib/lineup-draft-load";
import { supabase } from "@/lib/supabase";
import { LineupPlayerCard } from "@/components/player-card";

const SALARY_CAP = 50_000;
const ROSTER_MAX = 6;

type Props = {
  /** When set, loaded from My Lineups — save updates this draft instead of creating a new row. */
  editMode: DraftLineupEditorData | null;
  contestId: string;
  contestName: string;
  entryFeeLabel: string;
  entryFeeUsd: number;
  protectionFeeUsd: number;
  /** Contest `starts_at` has passed — roster and entry actions are disabled (server also enforces). */
  contestLineupLocked?: boolean;
  /** When set, user cannot add another paid entry (e.g. per-user max); disables pay & shows banner. */
  payEntryBlockedBanner?: string | null;
};

function formatMoneyUsd(n: number) {
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

export function LineupBuilder({
  editMode,
  contestId,
  contestName,
  entryFeeLabel,
  entryFeeUsd,
  protectionFeeUsd,
  contestLineupLocked = false,
  payEntryBlockedBanner = null,
}: Props) {
  const router = useRouter();
  const [golfers, setGolfers] = useState<GolferRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingGolfers, setLoadingGolfers] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entryStatus, setEntryStatus] = useState("");
  /** Set when paid entry succeeds — for confirmation + deep links. */
  const [confirmedLineupId, setConfirmedLineupId] = useState<string | null>(null);
  const [safetyPoolContributionUsd, setSafetyPoolContributionUsd] = useState<number | null>(null);
  const [savePending, startSaveTransition] = useTransition();
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [lineupSaveSuccess, setLineupSaveSuccess] = useState(false);
  const [swapTargetSlot, setSwapTargetSlot] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const hydratedEditRef = useRef(false);
  const { wallet } = useWallet();

  const tier = useMemo(
    () => (wallet ? tierFromPoints(wallet.loyalty_points) : "Bronze"),
    [wallet],
  );
  const discountPct = TIER_BENEFITS[tier].protectionDiscountPercent;

  /** Automatic coverage: single safety fee at entry (tier discount applies). */
  const protectionFeeApplied = useMemo(
    () => computeProtectionFeeUsd(protectionFeeUsd, 1, tier),
    [protectionFeeUsd, tier],
  );
  const protectionBaseSubtotal = useMemo(() => {
    return Math.round(protectionFeeUsd * 100) / 100;
  }, [protectionFeeUsd]);

  const totalEntryCostUsd = entryFeeUsd + protectionFeeApplied;

  useEffect(() => {
    let cancelled = false;

    async function loadGolfers() {
      if (!supabase) {
        if (!cancelled) {
          setLoadError("Missing Supabase environment variables.");
          setGolfers([]);
          setLoadingGolfers(false);
        }
        return;
      }

      if (!cancelled) setLoadingGolfers(true);
      const { data, error } = await supabase
        .from("golfers")
        .select("id,name,salary,pga_id,image_url,game_start_time")
        .order("salary", { ascending: false });

      if (cancelled) return;

      if (error) {
        setLoadError(error.message);
        setGolfers([]);
      } else {
        setLoadError(null);
        setGolfers((data ?? []) as GolferRow[]);
      }
      setLoadingGolfers(false);
    }

    void loadGolfers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hydratedEditRef.current = false;
  }, [editMode?.lineupId]);

  useEffect(() => {
    setSwapTargetSlot(null);
  }, [editMode?.lineupId, editMode?.editingContestEntryId]);

  useEffect(() => {
    const active = Boolean(editMode?.editingContestEntryId && editMode?.lateSwapWindowOpen);
    if (!active) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [editMode?.editingContestEntryId, editMode?.lateSwapWindowOpen]);

  useEffect(() => {
    if (!editMode || loadingGolfers || hydratedEditRef.current || golfers.length === 0) return;
    const pool = new Set(golfers.map((g) => g.id));
    const ok = editMode.golferIds.length === ROSTER_MAX && editMode.golferIds.every((id) => pool.has(id));
    if (!ok) {
      setLoadError("Could not restore saved golfers — try again or rebuild your lineup.");
      hydratedEditRef.current = true;
      return;
    }
    setSelectedIds([...editMode.golferIds]);
    hydratedEditRef.current = true;
  }, [editMode, loadingGolfers, golfers]);

  const entryConfirmed = entryStatus === "__SUCCESS__";

  useEffect(() => {
    if (!entryConfirmed) return;
    const t = window.setTimeout(() => {
      router.push("/dashboard/lineups");
    }, 3000);
    return () => window.clearTimeout(t);
  }, [entryConfirmed, router]);

  const filteredGolfers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return golfers;
    return golfers.filter((g) => g.name.toLowerCase().includes(q));
  }, [golfers, search]);

  const golferById = useMemo(() => new Map(golfers.map((g) => [g.id, g])), [golfers]);

  const selectedGolfers = useMemo(() => {
    return selectedIds
      .map((id) => golferById.get(id))
      .filter((g): g is GolferRow => g !== undefined);
  }, [golferById, selectedIds]);

  const salaryUsed = selectedGolfers.reduce((sum, g) => sum + g.salary, 0);
  const remainingSalary = SALARY_CAP - salaryUsed;
  const rosterCount = selectedGolfers.length;
  const rosterFull = rosterCount >= ROSTER_MAX;
  const salaryCapExceeded = salaryUsed > SALARY_CAP;

  const validation = useMemo(() => {
    const errors: string[] = [];
    if (salaryCapExceeded) {
      errors.push("Salary cap exceeded");
    }
    if (rosterCount !== ROSTER_MAX) {
      errors.push(
        `You must select exactly ${ROSTER_MAX} golfers (you have ${rosterCount}).`,
      );
    }
    return { ok: errors.length === 0, errors };
  }, [rosterCount, salaryCapExceeded]);

  const canSubmit = validation.ok;
  const editingContestEntryId = editMode?.editingContestEntryId;
  const lateSwapActive = Boolean(editingContestEntryId && editMode?.lateSwapWindowOpen);
  const rosterFrozen = contestLineupLocked && !lateSwapActive;

  /** Save draft: roster + cap only; contest is optional (stored as null until you enter from lobby). */
  const canSaveLineup = rosterCount === ROSTER_MAX && !salaryCapExceeded;

  const saveLineupDisabledReason = useMemo(() => {
    if (salaryCapExceeded) {
      return "Salary cap exceeded — adjust your lineup before saving.";
    }
    if (rosterCount !== ROSTER_MAX) {
      return `Select exactly ${ROSTER_MAX} golfers (currently ${rosterCount}).`;
    }
    return null;
  }, [salaryCapExceeded, rosterCount]);

  /** Pay & enter: full validation + real contest from lobby. */
  const canPayAndEnter =
    !editingContestEntryId &&
    canSubmit &&
    contestId !== "default" &&
    !contestLineupLocked &&
    !payEntryBlockedBanner;

  const payDisabledReason = useMemo(() => {
    if (editingContestEntryId) {
      return "Editing an existing entry — payment is not available.";
    }
    if (payEntryBlockedBanner) {
      return payEntryBlockedBanner;
    }
    if (contestLineupLocked) {
      return "Contest started — lineups locked";
    }
    if (contestId === "default") {
      return "Open the lobby, pick a contest, then use Lineup Builder from there (or enter from My Lineups).";
    }
    return saveLineupDisabledReason ?? (canSubmit ? null : "Fix lineup issues before paying.");
  }, [
    contestId,
    contestLineupLocked,
    payEntryBlockedBanner,
    saveLineupDisabledReason,
    canSubmit,
    editingContestEntryId,
  ]);

  function addGolfer(golferId: string, salary: number) {
    if (rosterFrozen) return;
    setEntryStatus("");
    setConfirmedLineupId(null);

    if (lateSwapActive && swapTargetSlot !== null) {
      const i = swapTargetSlot;
      setSelectedIds((prev) => {
        if (prev.length !== ROSTER_MAX) return prev;
        if (prev[i] === golferId) {
          return prev;
        }
        if (prev.some((id, j) => j !== i && id === golferId)) {
          return prev;
        }
        const used = prev.reduce(
          (sum, id, j) => sum + (j === i ? 0 : (golferById.get(id)?.salary ?? 0)),
          0,
        );
        if (used + salary > SALARY_CAP) return prev;
        const next = [...prev];
        next[i] = golferId;
        return next;
      });
      setSwapTargetSlot(null);
      return;
    }

    setSelectedIds((prev) => {
      if (prev.includes(golferId)) return prev;
      if (prev.length >= ROSTER_MAX) return prev;
      const used = prev.reduce((sum, id) => sum + (golferById.get(id)?.salary ?? 0), 0);
      if (used + salary > SALARY_CAP) return prev;
      return [...prev, golferId];
    });
  }

  function removeGolfer(golferId: string) {
    if (rosterFrozen || lateSwapActive) return;
    setEntryStatus("");
    setConfirmedLineupId(null);
    setSelectedIds((prev) => prev.filter((id) => id !== golferId));
  }

  function saveLineupToSupabase() {
    if (rosterFrozen) {
      setEntryStatus("Contest started — lineups locked");
      return;
    }
    if (salaryCapExceeded) {
      setEntryStatus("Salary cap exceeded — cannot save this lineup.");
      return;
    }
    if (rosterCount !== ROSTER_MAX) {
      setEntryStatus(`Select exactly ${ROSTER_MAX} golfers before saving.`);
      return;
    }
    startSaveTransition(async () => {
      const result = editingContestEntryId
        ? await editContestEntryLineup({
            entryId: editingContestEntryId,
            lineupId: editMode?.lineupId ?? "",
            contestId,
            golfers: selectedGolfers,
          })
        : await saveLineupDraft({
            golfers: selectedGolfers,
            contestId,
            lineupId: editMode?.lineupId,
          });
      if (result.ok) {
        setLineupSaveSuccess(true);
        setEntryStatus(editMode ? "Lineup updated" : "Lineup saved");
        const hasContest = Boolean(contestId.trim()) && contestId !== "default";
        // Edit draft → My Lineups. New lineup from contest link → Lobby. New practice draft → My Lineups.
        const destination =
          editMode != null ? "/dashboard/lineups" : hasContest ? "/lobby" : "/dashboard/lineups";
        window.setTimeout(() => {
          router.push(destination);
        }, 900);
        return;
      }
      const msg = result.error?.trim() || "Could not save lineup. Please try again.";
      setEntryStatus(msg);
    });
  }

  function submitLineupToSupabase() {
    if (contestLineupLocked) {
      setEntryStatus("Contest started — lineups locked");
      return;
    }
    if (editingContestEntryId) {
      setEntryStatus("You are editing an existing entry. Save changes instead.");
      return;
    }
    if (contestId === "default") {
      setEntryStatus("Pick a contest from the lobby (or open a contest-specific lineup link) before paying.");
      return;
    }
    if (salaryCapExceeded) {
      setEntryStatus("Salary cap exceeded");
      return;
    }
    if (rosterCount !== ROSTER_MAX) {
      setEntryStatus("Invalid lineup: select exactly 6 golfers.");
      return;
    }
    if (salaryUsed > SALARY_CAP) {
      setEntryStatus("Salary cap exceeded");
      return;
    }
    if (!canSubmit) {
      setEntryStatus("Fix the issues above before paying.");
      return;
    }
    setPaySubmitting(true);
    void (async () => {
      try {
        const result = await submitLineup({
          golfers: selectedGolfers,
          contestId,
        });
        if (result.ok) {
          localStorage.setItem("cashcaddie-lineup", JSON.stringify(selectedGolfers));
          setConfirmedLineupId(result.lineupId);
          setSafetyPoolContributionUsd(result.safetyContributionUsd ?? 0);
          setEntryStatus("__SUCCESS__");
          void refreshWallet();
          return;
        }
        const msg = result.error?.trim() || "Entry failed. Please try again or check your account balance.";
        setEntryStatus(msg);
      } catch (e) {
        setEntryStatus(
          e instanceof Error ? e.message : "Entry failed. Please try again or check your account balance.",
        );
      }
      setPaySubmitting(false);
    })();
  }

  return (
    <div className="flex min-h-[60vh] flex-col">
      {lateSwapActive ? (
        <div
          className="border-b border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-center text-sm font-semibold text-emerald-100"
          role="status"
        >
          {LATE_SWAP_HEADER_NOTICE}
        </div>
      ) : null}
      {rosterFrozen ? (
        <div
          className="border-b border-amber-500/40 bg-amber-950/50 px-4 py-3 text-center text-sm font-semibold text-amber-100"
          role="alert"
        >
          Contest started — lineups locked
        </div>
      ) : null}
      {payEntryBlockedBanner && !contestLineupLocked && (
        <div
          className="border-b border-amber-500/40 bg-amber-950/50 px-4 py-3 text-center text-sm font-semibold text-amber-100"
          role="alert"
          aria-live="polite"
        >
          {payEntryBlockedBanner}
        </div>
      )}
      {/* Summary — DFS-style (cap / remaining / count) */}
      <div className="sticky top-0 z-20 border-b border-[#2a3039] bg-[#0c1015]">
        <div className="grid grid-cols-2 gap-px bg-[#2a3039] sm:grid-cols-4">
          <div className="bg-[#141920] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              Salary cap
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">
              ${SALARY_CAP.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#141920] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              Salary used
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#e8ecf0]">
              ${salaryUsed.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#141920] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              Remaining
            </p>
            <p
              className={`mt-1 text-2xl font-black tabular-nums ${
                remainingSalary >= 0 ? "text-[#53d769]" : "text-red-400"
              }`}
            >
              ${remainingSalary.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#141920] px-4 py-4 sm:px-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              Selected
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">
              {rosterCount}/{ROSTER_MAX}
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-[#1a1f26]">
          <div
            className={`h-full transition-[width] ${
              salaryCapExceeded
                ? "bg-gradient-to-r from-red-700 to-red-500"
                : "bg-gradient-to-r from-[#1f8a3b] to-[#53d769]"
            }`}
            style={{ width: `${Math.min(100, (salaryUsed / SALARY_CAP) * 100)}%` }}
          />
        </div>
        {salaryCapExceeded && (
          <div
            className="border-t border-red-500/50 bg-red-950/80 px-4 py-2.5 text-center text-sm font-semibold text-red-200"
            role="alert"
            aria-live="assertive"
          >
            Salary cap exceeded
          </div>
        )}
      </div>

      <div className="border-x border-t border-[#2a3039] bg-[#141920] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">Contest entry</p>
          {contestLineupLocked && contestId !== "default" ? (
            <span className="rounded border border-red-500/50 bg-red-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
              LIVE
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[#c5cdd5]">{contestName}</p>
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-[#0c1410] px-3 py-3 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.08)]">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Automatic Safety Coverage Enabled</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#c5cdd5]">
            Automatic Safety Coverage. If any golfer withdraws before Round 1 lock, your entry receives a Safety
            Coverage Credit equal to the entry fee.
          </p>
        </div>
        <div className="mt-4 space-y-3 text-sm text-[#e8ecf0]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a3039] pb-3">
            <span className="text-[#c5cdd5]">Entry fee</span>
            <span className="font-semibold tabular-nums text-white">
              {entryFeeUsd > 0 ? entryFeeLabel : formatMoneyUsd(0)}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[#c5cdd5]">CashCaddies Safety Coverage (automatic)</span>
            <span className="font-semibold tabular-nums text-[#53d769]">{formatMoneyUsd(protectionFeeUsd)}</span>
          </div>
          <p className="text-[11px] leading-snug text-[#6b7684]">
            Your tier ({tier})
            {discountPct > 0 ? ` · ${discountPct}% protection discount` : ""}. Applied at checkout.
          </p>
          <p className="text-xs text-[#8b98a5]">
            Safety coverage subtotal:{" "}
            {discountPct > 0 && protectionBaseSubtotal > 0 ? (
              <>
                <span className="line-through opacity-60">{formatMoneyUsd(protectionBaseSubtotal)}</span>{" "}
              </>
            ) : null}
            <span className="font-semibold text-[#53d769]">{formatMoneyUsd(protectionFeeApplied)}</span>
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2a3039] pt-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8b98a5]">Total entry cost</span>
            <span className="text-lg font-black tabular-nums text-white">{formatMoneyUsd(totalEntryCostUsd)}</span>
          </div>
          {wallet && totalEntryCostUsd > 0 ? (
            <p className="text-[11px] leading-snug text-[#6b7684]">
              Spendable:{" "}
              <span className="font-semibold text-[#c5cdd5]">
                {formatMoneyUsd((wallet.protection_credit_balance ?? 0) + wallet.account_balance)}
              </span>{" "}
              (safety coverage credit applied before cash)
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Player pool */}
        <div className="min-w-0 flex-1 border-[#2a3039] lg:border-r">
          {loadError && (
            <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {loadError}
            </div>
          )}
          <div className="border-b border-[#2a3039] bg-[#1a1f26] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#c5cdd5]">Player pool</h2>
                <p className="mt-0.5 text-[11px] text-[#6b7684]">
                  Sorted by salary · highest first
                  {lateSwapActive && swapTargetSlot !== null ? (
                    <span className="mt-1 block font-semibold text-emerald-200/90">
                      Choose a replacement for G{swapTargetSlot + 1} — then save.
                    </span>
                  ) : null}
                </p>
              </div>
              <label className="block w-full sm:max-w-xs">
                <span className="sr-only">Search golfers by name</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  autoComplete="off"
                  className="w-full rounded border border-[#2a3039] bg-[#0f1419] px-3 py-2 text-sm text-[#e8ecf0] placeholder:text-[#6b7684] focus:border-[#3d8bfd] focus:outline-none focus:ring-1 focus:ring-[#3d8bfd]/50"
                />
              </label>
            </div>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-[#2a3039] bg-[#141920] text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
                <tr>
                  <th className="px-3 py-2.5 pl-4 sm:pl-5">Name</th>
                  <th className="px-3 py-2.5">Salary</th>
                  <th className="w-[100px] px-3 py-2.5 pr-4 text-right sm:pr-5" />
                </tr>
              </thead>
              <tbody className="text-[#e8ecf0]">
                {loadingGolfers && (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-[#6b7684]">
                      Loading golfers…
                    </td>
                  </tr>
                )}
                {!loadingGolfers && golfers.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[#6b7684]">
                      No golfers in the database. Run the Supabase seed migration.
                    </td>
                  </tr>
                )}
                {!loadingGolfers &&
                  golfers.length > 0 &&
                  filteredGolfers.length === 0 &&
                  search.trim() !== "" && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[#6b7684]">
                        No players match &quot;{search.trim()}&quot;.
                      </td>
                    </tr>
                  )}
                {!loadingGolfers &&
                  filteredGolfers.map((golfer, index) => {
                  const inLineup = selectedIds.includes(golfer.id);
                  const replaceMode = lateSwapActive && swapTargetSlot !== null;
                  const atReplaceSlot =
                    replaceMode && swapTargetSlot !== null && selectedIds[swapTargetSlot] === golfer.id;

                  let projectedSalaryUsed = salaryUsed;
                  if (replaceMode && swapTargetSlot !== null && !inLineup) {
                    const curId = selectedIds[swapTargetSlot];
                    const curSal = curId ? golferById.get(curId)?.salary ?? 0 : 0;
                    projectedSalaryUsed = salaryUsed - curSal + golfer.salary;
                  } else if (!inLineup) {
                    projectedSalaryUsed = salaryUsed + golfer.salary;
                  }

                  const wouldExceedCap = projectedSalaryUsed > SALARY_CAP;
                  const addDisabled =
                    (inLineup && !(replaceMode && atReplaceSlot)) ||
                    (!inLineup && rosterFull && !replaceMode) ||
                    wouldExceedCap ||
                    salaryCapExceeded ||
                    rosterFrozen ||
                    (replaceMode && inLineup && !atReplaceSlot);

                  const selectAction = replaceMode && !inLineup && !addDisabled;

                  return (
                    <tr
                      key={golfer.id}
                      className={`border-b border-[#232a33] transition-colors hover:bg-[#161c24] ${
                        index % 2 === 0 ? "bg-[#0f1419]" : "bg-[#0c1015]"
                      }`}
                    >
                      <td className="px-3 py-2.5 pl-4 sm:pl-5">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#2a3039]">
                            {golfer.image_url ? (
                              <Image
                                src={golfer.image_url}
                                alt={golfer.name}
                                width={36}
                                height={36}
                                className="h-9 w-9 object-cover"
                              />
                            ) : (
                              <span className="flex h-9 w-9 items-center justify-center text-[10px] font-bold text-[#6b7684]">
                                {golfer.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-white">{golfer.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[#c5cdd5]">
                        ${golfer.salary.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 pr-4 text-right sm:pr-5">
                        {lateSwapActive && atReplaceSlot ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#6b7684]">
                            Current
                          </span>
                        ) : inLineup ? (
                          lateSwapActive ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#6b7684]">
                              In lineup
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={rosterFrozen}
                              onClick={() => removeGolfer(golfer.id)}
                              className="rounded border border-[#3d4550] bg-[#1c2128] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#e8ecf0] hover:bg-[#2a3039] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Remove
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={addDisabled}
                            title={
                              rosterFrozen
                                ? "Contest started — lineups locked"
                                : wouldExceedCap || salaryCapExceeded
                                  ? "Salary cap exceeded"
                                  : replaceMode && rosterFull && swapTargetSlot === null
                                    ? "Choose a roster slot to swap first"
                                    : undefined
                            }
                            onClick={() => addGolfer(golfer.id, golfer.salary)}
                            className="rounded border border-[#2d7a3a] bg-[#1f8a3b] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#249544] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {selectAction ? "Select" : "Add"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lineup column — DFS-style */}
        <aside className="w-full shrink-0 border-t border-[#2a3039] bg-[#0f1419] lg:w-[340px] lg:border-t-0 lg:border-l">
          <div className="border-b border-[#2a3039] bg-[#1a1f26] px-4 py-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#c5cdd5]">
              Your lineup
            </h2>
            <p className="mt-0.5 text-[11px] text-[#6b7684]">
              {rosterCount}/{ROSTER_MAX} golfers · ${salaryUsed.toLocaleString()} used · $
              {remainingSalary.toLocaleString()} left
            </p>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8b98a5]">
              Selected players
            </p>
            {Array.from({ length: ROSTER_MAX }).map((_, slot) => {
              const g = selectedGolfers[slot];
              const slotsMeta = editMode?.rosterSlots;
              const slotLocked = Boolean(slotsMeta?.[slot]?.isLocked);
              const countdownLabel = playerSlotLockCountdownLabel(slotsMeta?.[slot]?.gameStartTime, nowTick);
              return (
                <LineupPlayerCard
                  key={slot}
                  slotIndex={slot}
                  golfer={g}
                  slotLocked={slotLocked}
                  countdownLabel={countdownLabel}
                  lateSwapActive={lateSwapActive}
                  swapTargetActive={swapTargetSlot === slot}
                  rosterFrozen={rosterFrozen}
                  onSwap={() => setSwapTargetSlot((s) => (s === slot ? null : slot))}
                  onRemove={() => g && removeGolfer(g.id)}
                />
              );
            })}
          </div>

          <div
            className={`mx-4 rounded-lg border px-3 py-2.5 text-xs ${
              canSaveLineup
                ? validation.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
                : "border-amber-500/40 bg-amber-500/10 text-amber-100"
            }`}
            role="status"
          >
            {canSaveLineup ? (
              <div className="space-y-1.5">
                <p className="font-medium">
                  Ready to save — 6 players, salary at or under ${SALARY_CAP.toLocaleString()}.
                </p>
                {!validation.ok && (
                  <p className="text-[11px] leading-snug text-amber-200/95">
                    Pay &amp; enter still needs:{" "}
                    {validation.errors.filter((m) => !m.includes("Salary cap") && !m.includes("exactly")).join(" · ") ||
                      "see checklist above."}
                  </p>
                )}
              </div>
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {validation.errors.map((msg) => (
                  <li key={msg} className={msg === "Salary cap exceeded" ? "font-semibold text-red-200" : ""}>
                    {msg}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 p-4 pt-3">
            <button
              type="button"
              onClick={saveLineupToSupabase}
              title={
                rosterFrozen
                  ? "Contest started — lineups locked"
                  : (saveLineupDisabledReason ?? undefined)
              }
              className="inline-flex w-full items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#249544] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                !canSaveLineup ||
                savePending ||
                paySubmitting ||
                lineupSaveSuccess ||
                rosterFrozen ||
                entryConfirmed ||
                (lateSwapActive && swapTargetSlot !== null)
              }
            >
              {savePending ? (
                <>
                  <InlineSpinner className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin text-white" />
                  Saving…
                </>
              ) : editMode ? (
                "Save changes"
              ) : (
                "Save lineup"
              )}
            </button>
            <button
              type="button"
              onClick={submitLineupToSupabase}
              title={payDisabledReason ?? undefined}
              className="inline-flex w-full items-center justify-center rounded border border-[#3d4550] bg-[#1c2128] py-2.5 text-sm font-semibold uppercase tracking-wide text-[#e8ecf0] hover:bg-[#2a3039] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                !canPayAndEnter || savePending || paySubmitting || lineupSaveSuccess || entryConfirmed
              }
            >
              {paySubmitting ? (
                <>
                  <InlineSpinner className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin text-[#e8ecf0]" />
                  Processing…
                </>
              ) : (
                "Save & pay entry now"
              )}
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-[#6b7684]">
              <span className="font-semibold text-[#8b98a5]">Save lineup</span> saves{" "}
              <span className="text-[#8b98a5]">lineups</span> +{" "}
              <span className="text-[#8b98a5]">lineup_players</span> with 6 golfers under the cap. If you opened this
              page with a contest, you&apos;ll return to the lobby to enter; otherwise you&apos;ll go to My Lineups.{" "}
              <span className="font-semibold text-[#8b98a5]">Save &amp; pay</span> needs a contest and charges your
              wallet.
            </p>
            {entryStatus &&
              entryStatus !== "__SUCCESS__" &&
              entryStatus !== "Lineup saved" &&
              entryStatus !== "Lineup updated" && (
              <div
                role="alert"
                aria-live="assertive"
                className={`mt-2 rounded border px-3 py-2.5 text-center text-sm font-medium ${
                  entryStatus === "Salary cap exceeded"
                    ? "border-red-500/50 bg-red-950/50 text-red-100"
                    : "border-amber-500/50 bg-amber-950/40 text-amber-100"
                }`}
              >
                {entryStatus}
              </div>
            )}
            {(entryStatus === "Lineup saved" || entryStatus === "Lineup updated") && (
              <p className="mt-2 text-center text-sm font-semibold text-[#53d769]" role="status">
                {entryStatus}
              </p>
            )}
            {entryConfirmed && (
              <div
                role="status"
                aria-live="polite"
                className="mt-3 rounded-lg border border-emerald-500/30 bg-[#0c1410] px-4 py-4 text-left shadow-[inset_0_1px_0_0_rgba(16,185,129,0.08)]"
              >
                <p className="text-center text-base font-black tracking-tight text-white">
                  Entry Confirmed <span aria-hidden="true">✅</span>
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">Contest</dt>
                    <dd className="mt-1 font-semibold text-[#e8ecf0]">
                      {contestName}
                      <span className="text-[#6b7684]"> · </span>
                      <span className="tabular-nums text-white">
                        {entryFeeUsd > 0 ? entryFeeLabel : formatMoneyUsd(0)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
                      Protection
                    </dt>
                    <dd className="mt-1 text-[#c5cdd5]">
                      Automatic — activates if any roster golfer is WD, DQ, or DNS.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
                      Safety contribution
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[#53d769]">
                      {formatMoneyUsd(safetyPoolContributionUsd ?? 0)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={`/contest/${encodeURIComponent(contestId)}`}
                    className="inline-flex w-full items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-4 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
                  >
                    View Contest
                  </Link>
                  <Link
                    href={`/contest/${encodeURIComponent(contestId)}#leaderboard`}
                    className="inline-flex w-full items-center justify-center rounded border border-[#3d4550] bg-[#1c2128] px-4 py-2.5 text-center text-sm font-semibold uppercase tracking-wide text-[#e8ecf0] hover:bg-[#2a3039]"
                  >
                    View Leaderboard
                  </Link>
                  <Link
                    href={
                      confirmedLineupId
                        ? `/lineup?edit=${encodeURIComponent(confirmedLineupId)}`
                        : "/dashboard/lineups"
                    }
                    className="inline-flex w-full items-center justify-center rounded border border-[#3d4550] bg-[#1c2128] px-4 py-2.5 text-center text-sm font-semibold uppercase tracking-wide text-[#e8ecf0] hover:bg-[#2a3039]"
                  >
                    View Lineup
                  </Link>
                </div>
                <p className="mt-3 text-center text-[11px] text-[#6b7684]">
                  Redirecting to My Lineups in 3 seconds…
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
