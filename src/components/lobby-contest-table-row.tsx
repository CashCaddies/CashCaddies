"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { getProfile } from "@/lib/getProfile";
import { isAdmin } from "@/lib/permissions";
import type { LobbyContestRow } from "@/lib/contest-lobby-shared";
import {
  formatContestStartDate,
  formatLobbyEntryFeeUsd,
  formatPerUserEntryLimit,
  formatProtectedEntriesPercent,
} from "@/lib/contest-lobby-shared";
import { resolveEffectiveContestLifecycle } from "@/lib/contest-state";
import { deleteContestAdmin } from "@/app/(protected)/admin/contests/actions";
import { supabase } from "@/lib/supabase/client";
import { AdminContestControls } from "@/components/admin-contest-controls";
import { ContestFullBadge, ContestLifecycleStatusBadge, ContestLockCountdown } from "@/components/contest-card";
import { useAuth } from "@/contexts/auth-context";

type Props = {
  contest: LobbyContestRow;
  index: number;
  /** When provided by lobby shell, avoids duplicate profile fetch and timing issues */
  viewerRole?: string | null;
  /** Merge server-side updates into lobby list without full page reload */
  onContestPatched?: (contestId: string, patch: Partial<LobbyContestRow>) => void;
  onContestRemoved?: (contestId: string) => void;
  onRefresh?: (opts?: { initial?: boolean }) => Promise<void>;
  /** Opens contest details (e.g. modal) when the row is activated */
  onRowClick?: () => void;
};

function stopRowNavigation(e: MouseEvent) {
  e.stopPropagation();
}

export function LobbyContestTableRow({
  contest,
  index,
  viewerRole,
  onContestPatched,
  onContestRemoved,
  onRefresh,
  onRowClick,
}: Props) {
  const { user } = useAuth();
  const [entering, setEntering] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  /** Current user already has a row in contest_entries for this contest */
  const [userHasEntry, setUserHasEntry] = useState(false);
  const [justEntered, setJustEntered] = useState(false);
  const justEnteredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<{ role: string | null } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");
  const isCreatedContest = createdId === contest.id;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [loading, setLoading] = useState(false);
  const href = `/contest/${encodeURIComponent(contest.id)}`;
  const max = Math.max(1, contest.max_entries);
  const currentFromDb =
    contest.current_entries != null && String(contest.current_entries).trim() !== ""
      ? Number(contest.current_entries)
      : NaN;
  const currentBase = Number.isFinite(currentFromDb)
    ? Math.max(0, Math.floor(currentFromDb))
    : Math.max(0, Math.floor(Number(contest.entry_count) || 0));
  const current = Math.min(currentBase, max);
  const isFull = current >= max;
  const isEntered = userHasEntry;
  const protectedCount = Math.max(0, Math.trunc(Number(contest.protected_entries_count ?? 0)));
  const protectedPctLabel = formatProtectedEntriesPercent(currentBase, protectedCount);
  const safetyPoolUsd = contest.safety_pool_usd ?? 0;
  const fillPercent = Math.min(100, Math.round((current / max) * 100));
  const perUserLabel = formatPerUserEntryLimit(contest.max_entries_per_user);
  const hasPayouts = contest.payouts.length > 0;
  const lifecycle = resolveEffectiveContestLifecycle({
    status: contest.status,
    starts_at: contest.starts_at,
    entries_open_at: contest.entries_open_at,
    created_at: contest.created_at,
    has_settlement: contest.has_settlement,
  });
  const entryFeeSource =
    contest.entry_fee != null && String(contest.entry_fee).trim() !== ""
      ? contest.entry_fee
      : contest.entry_fee_usd;
  const admin =
    viewerRole !== undefined
      ? isAdmin(viewerRole)
      : profileLoaded
        ? isAdmin(profile?.role)
        : false;

  const handleRowActivate = () => {
    onRowClick?.();
  };

  const refreshContests = async () => {
    if (!onRefresh) return;
    await onRefresh({ initial: false });
  };

  const triggerJustEnteredFeedback = () => {
    if (justEnteredTimerRef.current) {
      clearTimeout(justEnteredTimerRef.current);
    }
    setJustEntered(true);
    justEnteredTimerRef.current = setTimeout(() => {
      setJustEntered(false);
      justEnteredTimerRef.current = null;
    }, 1200);
  };

  type EnterContestRpcRow = {
    ok?: boolean;
    current_entries?: number;
    error?: string;
    message?: string;
  };

  const handleEnterContest = async (e: MouseEvent) => {
    e.stopPropagation();
    setEntryError(null);

    if (isFull || isEntered) {
      return;
    }

    if (!user?.id) {
      setEntryError("Sign in to enter contests.");
      return;
    }

    if (!supabase) {
      setEntryError("Unable to connect. Try again.");
      return;
    }

    setEntering(true);

    try {
      const { data, error } = await supabase.rpc("enter_contest", {
        p_contest_id: contest.id,
      });

      if (error) {
        setEntryError(error.message);
        return;
      }

      const row = data as EnterContestRpcRow | null;
      if (row && row.ok === false) {
        const msg =
          typeof row.message === "string" && row.message.trim() !== ""
            ? row.message
            : typeof row.error === "string" && row.error.trim() !== ""
              ? row.error
              : "Unable to enter contest. Try again.";
        const already =
          /already/i.test(msg) ||
          String(row.error ?? "").toLowerCase() === "already_entered" ||
          String(row.message ?? "").toLowerCase() === "already_entered";
        if (already) {
          setUserHasEntry(true);
          triggerJustEnteredFeedback();
          return;
        }
        setEntryError(msg);
        return;
      }

      const nextCount =
        row != null && typeof row.current_entries === "number" && Number.isFinite(row.current_entries)
          ? Math.max(0, Math.floor(row.current_entries))
          : (contest.current_entries ?? contest.entry_count ?? 0) + 1;

      setUserHasEntry(true);
      onContestPatched?.(contest.id, {
        current_entries: nextCount,
        entry_count: nextCount,
      });

      const rpcMissingCount =
        row == null ||
        typeof row.current_entries !== "number" ||
        !Number.isFinite(row.current_entries);
      const wasNearFull = max > 0 && current >= max - 1;
      if (rpcMissingCount || wasNearFull) {
        await refreshContests();
      }

      triggerJustEnteredFeedback();
    } catch (err) {
      console.error("Unexpected error:", err);
      setEntryError("Something went wrong. Try again.");
    } finally {
      setEntering(false);
    }
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowActivate();
    }
  };

  useEffect(() => {
    if (!user?.id || !supabase) {
      setUserHasEntry(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("contest_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("contest_id", contest.id)
        .maybeSingle();
      if (!cancelled) {
        setUserHasEntry(!!data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, contest.id]);

  useEffect(() => {
    if (!isCreatedContest) return;
    const id = requestAnimationFrame(() => {
      const el = rowRef.current;
      if (!el || typeof el.isConnected !== "boolean" || !el.isConnected) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* detached / layout — avoid parentNode errors */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isCreatedContest]);

  useEffect(() => {
    if (viewerRole !== undefined) {
      setProfileLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const p = await getProfile();
      if (!cancelled) {
        setProfile(p ? { role: p.role } : { role: null });
        setProfileLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerRole]);

  useEffect(() => {
    return () => {
      if (justEnteredTimerRef.current) {
        clearTimeout(justEnteredTimerRef.current);
      }
    };
  }, []);

  const handleDelete = async () => {
    if (loading) return;
    if (!user?.id) {
      console.error(new Error("You must be signed in to delete a contest."));
      return;
    }

    setLoading(true);
    try {
      const result = await deleteContestAdmin(user.id, contest.id);
      if (!result.ok) {
        console.error(result.error);
        return;
      }
      onContestRemoved?.(contest.id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (!supabase) {
        console.error(new Error("Supabase client is not available."));
      } else {
        const { data, error } = await supabase.rpc("settle_contest_prizes", {
          p_contest_id: contest.id,
        });

        if (error) {
          console.error(error);
        } else {
          const row = data as { ok?: boolean } | null;
          if (row && row.ok === false) {
            console.error(data);
          } else {
            onContestPatched?.(contest.id, { status: "settled", has_settlement: true });
            return;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <tr
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${contest.name}`}
      onClick={handleRowActivate}
      onKeyDown={onRowKeyDown}
      className={`
        border-b border-[#232a33] transition-all duration-300
        hover:bg-[#161c24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3d8bfd]
        ${index % 2 === 0 ? "bg-[#0f1419]" : "bg-[#0c1015]"}
        ${isCreatedContest ? "highlightContest" : ""}
        ${justEntered ? "scale-[1.02] bg-green-50" : ""}
        cursor-pointer
      `}
    >
      <td className="px-4 py-3.5 pl-5 align-middle sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-white">{contest.name}</span>
          <ContestLifecycleStatusBadge status={contest.status} />
          {isFull ? <ContestFullBadge /> : null}
          <ContestLockCountdown lifecycle={lifecycle} startsAtIso={contest.starts_at} />
          {perUserLabel ? (
            <span className="shrink-0 rounded border border-[#3d4550] bg-[#1a1f26] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#a8b4c0]">
              {perUserLabel}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3.5 align-top text-[#c5cdd5]">
        <p className="font-medium">{formatLobbyEntryFeeUsd(entryFeeSource)}</p>
        <dl className="mt-2 space-y-1 text-[10px] leading-snug text-[#8b98a5]">
          <div className="flex flex-wrap gap-x-1.5 gap-y-0">
            <dt className="font-semibold uppercase tracking-wide text-[#6b7684]">Entries</dt>
            <dd className="tabular-nums text-[#c5cdd5]">
              {current.toLocaleString()} / {max.toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0">
            <dt className="font-semibold uppercase tracking-wide text-[#6b7684]">Safety Pool</dt>
            <dd className="tabular-nums text-[#53d769]">{formatLobbyEntryFeeUsd(safetyPoolUsd)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0">
            <dt className="font-semibold uppercase tracking-wide text-[#6b7684]">Protected Entries</dt>
            <dd className="tabular-nums text-emerald-200/95">{protectedPctLabel}%</dd>
          </div>
          <div className="flex flex-wrap gap-x-1.5 gap-y-0">
            <dt className="font-semibold uppercase tracking-wide text-[#6b7684]">Payouts</dt>
            <dd className={hasPayouts ? "tabular-nums text-[#c5cdd5]" : "text-[#8b98a5]"}>
              {hasPayouts ? `${contest.payouts.length} places` : "No payout structure"}
            </dd>
          </div>
        </dl>
      </td>
      <td className="px-3 py-3.5 align-middle text-right tabular-nums text-[#c5cdd5]">
        {contest.max_entries.toLocaleString()}
      </td>
      <td className="px-3 py-3.5 align-middle">
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs tabular-nums text-[#c5cdd5]">
            {current.toLocaleString()} / {max.toLocaleString()} entries
          </div>
          <div className="h-2 w-full max-w-[7rem] overflow-hidden rounded-full bg-[#2a3039]">
            <div
              className={`
                h-2 rounded-full
                ${fillPercent > 80 ? "bg-red-500" : ""}
                ${fillPercent > 50 && fillPercent <= 80 ? "bg-yellow-500" : ""}
                ${fillPercent <= 50 ? "bg-green-500" : ""}
              `}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle text-[#c5cdd5]">{formatContestStartDate(contest.starts_at)}</td>
      <td className="px-4 py-3.5 pr-5 text-right align-middle sm:px-5" onClick={stopRowNavigation}>
        <div className="flex flex-col items-end gap-1">
          {entryError ? (
            <p className="max-w-[14rem] text-right text-[11px] leading-snug text-red-400">{entryError}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={href}
            className="inline-flex shrink-0 items-center justify-center rounded border border-[#2f3640] bg-[#1c2128] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#c5cdd5] hover:bg-[#232a33] sm:px-4 sm:text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            View Contest
          </Link>
          <button
            type="button"
            className={`
              inline-flex shrink-0 items-center justify-center
              w-full md:w-auto rounded px-4 py-2
              text-xs font-bold uppercase tracking-wide sm:text-sm
              disabled:cursor-not-allowed disabled:opacity-70
              ${entering ? "bg-blue-600 text-white" : ""}
              ${!entering && isEntered ? "bg-green-600 text-white cursor-not-allowed" : ""}
              ${!entering && !isEntered && isFull ? "bg-gray-500 text-white cursor-not-allowed" : ""}
              ${!entering && !isEntered && !isFull ? "bg-blue-600 text-white hover:bg-blue-500" : ""}
              ${justEntered ? "ring-2 ring-green-400" : ""}
            `}
            onClick={(e) => {
              e.stopPropagation();
              void handleEnterContest(e);
            }}
            disabled={entering || isFull || isEntered}
          >
            {entering ? "Entering..." : isEntered ? "✓ Entered" : isFull ? "Full" : "Enter"}
          </button>
          {admin ? (
            <AdminContestControls
              contestId={contest.id}
              lifecycle={lifecycle}
              dbStatus={contest.status}
              lateSwapEnabled={contest.late_swap_enabled !== false}
            />
          ) : null}
          {admin && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  stopRowNavigation(e);
                  void handleSettle();
                }}
                disabled={loading}
              >
                {loading ? "LOADING..." : "SETTLE"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  stopRowNavigation(e);
                  void handleDelete();
                }}
                disabled={loading}
              >
                DELETE
              </button>
            </>
          )}
          </div>
        </div>
      </td>
    </tr>
  );
}
