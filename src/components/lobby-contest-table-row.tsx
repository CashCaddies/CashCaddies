"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { supabase } from "@/lib/supabase/client";
import { AdminContestControls } from "@/components/admin-contest-controls";
import { ContestFullBadge, ContestLifecycleStatusBadge, ContestLockCountdown } from "@/components/contest-card";
import { EnterContestButton } from "@/components/enter-contest-button";

type Props = {
  contest: LobbyContestRow;
  index: number;
  /** When provided by lobby shell, avoids duplicate profile fetch and timing issues */
  viewerRole?: string | null;
};

function stopRowNavigation(e: MouseEvent) {
  e.stopPropagation();
}

export function LobbyContestTableRow({ contest, index, viewerRole }: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState<{ role: string | null } | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const searchParams = useSearchParams();
  const createdId = searchParams.get("created");
  const isCreatedContest = createdId === contest.id;
  const rowRef = useRef<HTMLTableRowElement>(null);
  const [loading, setLoading] = useState(false);
  const href = `/contest/${encodeURIComponent(contest.id)}`;
  const max = Math.max(1, contest.max_entries);
  const current = Math.min(contest.entry_count || 0, max);
  const isFull = current >= max;
  const protectedCount = Math.max(0, Math.trunc(Number(contest.protected_entries_count ?? 0)));
  const protectedPctLabel = formatProtectedEntriesPercent(contest.entry_count || 0, protectedCount);
  const safetyPoolUsd = contest.safety_pool_usd ?? 0;
  const fillPct = Math.min(100, (current / max) * 100);
  const perUserLabel = formatPerUserEntryLimit(contest.max_entries_per_user);
  const hasPayouts = contest.payouts.length > 0;
  const lifecycle = resolveEffectiveContestLifecycle({
    status: contest.status,
    starts_at: contest.starts_at,
    entries_open_at: contest.entries_open_at,
    created_at: contest.created_at,
    has_settlement: contest.has_settlement,
  });
  const entryFeeUsd =
    typeof contest.entry_fee_usd === "string"
      ? Number.parseFloat(contest.entry_fee_usd)
      : Number(contest.entry_fee_usd);
  const admin =
    viewerRole !== undefined
      ? isAdmin(viewerRole)
      : profileLoaded
        ? isAdmin(profile?.role)
        : false;

  const go = () => {
    router.push(href);
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };

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

  const handleDelete = async () => {
    console.log("DELETE CLICKED", contest.id);
    if (loading) return;
    setLoading(true);

    try {
      if (!supabase) {
        console.error(new Error("Supabase client is not available."));
      } else {
        const { error } = await supabase.from("contests").delete().eq("id", contest.id);

        if (error) {
          console.error(error);
        } else {
          window.location.reload();
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
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
            window.location.reload();
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
      role="link"
      tabIndex={0}
      aria-label={`View contest ${contest.name}`}
      onClick={go}
      onKeyDown={onRowKeyDown}
      className={`border-b border-[#232a33] transition-colors hover:bg-[#161c24] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#3d8bfd] ${
        index % 2 === 0 ? "bg-[#0f1419]" : "bg-[#0c1015]"
      } ${isCreatedContest ? "highlightContest" : ""} cursor-pointer`}
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
        <p className="font-medium">{formatLobbyEntryFeeUsd(contest.entry_fee_usd)}</p>
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
                      <span className="tabular-nums text-[#c5cdd5]">{current.toLocaleString()}</span>
          <div className="h-1 w-full max-w-[7rem] overflow-hidden rounded-full bg-[#2a3039]">
            <div className="h-full rounded-full bg-[#3d8bfd]/80" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 align-middle text-[#c5cdd5]">{formatContestStartDate(contest.starts_at)}</td>
      <td className="px-4 py-3.5 pr-5 text-right align-middle sm:px-5" onClick={stopRowNavigation}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={href}
            className="inline-flex shrink-0 items-center justify-center rounded border border-[#2f3640] bg-[#1c2128] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#c5cdd5] hover:bg-[#232a33] sm:px-4 sm:text-sm"
          >
            View Contest
          </Link>
          <EnterContestButton
            contestId={contest.id}
            contestName={contest.name}
            entryFeeUsd={entryFeeUsd}
            contestMaxEntries={max}
            contestEntryCount={current}
            contestStatus={contest.status}
            maxEntriesPerUser={contest.max_entries_per_user}
          />
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
      </td>
    </tr>
  );
}
