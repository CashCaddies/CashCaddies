"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardStatusBadge } from "@/components/dashboard-status-badge";
import { LineupEntryStatusBadge } from "@/components/lineup-entry-status-badge";
import { ProtectionClaimControls } from "@/components/protection-claim-controls";
import { ProtectionLiveTag } from "@/components/protection-live-tag";
import { ProtectionSwapPanel } from "@/components/protection-swap-panel";
import {
  dashboardLineupContestPresentation,
  lineupHasContestEntry,
  resolveLineupEntryStatus,
} from "@/lib/dashboard-lineups";
import { useDashboardLineups } from "@/hooks/use-dashboard-lineups";
import { useInsuranceClaims } from "@/hooks/use-insurance-claims";
import { ContestLabPanel } from "@/components/contest-lab-modal";
import { splitEntryFeeUsd } from "@/lib/contest-fee-split";

function formatSubmitted(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatSafetyUsd(n: number) {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function MyLineupsPage() {
  const { user, lineups, error, loading, refresh } = useDashboardLineups();
  const lineupIds = useMemo(() => lineups.map((l) => l.id), [lineups]);
  const { getClaim, refresh: refreshClaims } = useInsuranceClaims(lineupIds);

  return (
    <DashboardShell
      title="My Lineups"
      description="Saved drafts can be edited from the lineup builder. Entered lineups stay locked."
    >
      {loading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">{error}</p>}
      {!loading && !user && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Sign in
          </Link>{" "}
          to see your lineups.
        </p>
      )}

      {user && !loading && (
        <div className="space-y-6">
          {lineups.length === 0 && (
            <p className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-6 text-center text-slate-500">
              No lineups yet.{" "}
              <Link href="/lobby" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
                Enter a contest
              </Link>
              .
            </p>
          )}
          {lineups.map((row) => {
            const pres = dashboardLineupContestPresentation(row);
            const entered = lineupHasContestEntry(row) && row.valid_contest_entry;
            const hasContest = Boolean(row.contest_id);
            const triggerGolfer = row.insured_golfer_id
              ? row.players.find((p) => p.id === row.insured_golfer_id) ?? null
              : null;
            const missingProtectionSelection = false;
            const entryStatus = resolveLineupEntryStatus(row);
            const protectionFundUsd =
              entered && row.valid_contest_entry
                ? row.protection_fee > 0
                  ? row.protection_fee
                  : splitEntryFeeUsd(row.entry_fee).protectionAmount
                : 0;
            const roster = row.players
              .map((p) => `${p.name}${p.withdrawn ? " (WD)" : ""}`)
              .join(", ");
            const wdProtected = row.protection_enabled
              ? row.players.filter((p) => p.withdrawn && p.protected)
              : [];
            return (
              <article
                key={row.id}
                className="goldCard p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {hasContest && row.contest_id ? (
                          <Link href={`/contest/${encodeURIComponent(row.contest_id)}`} className="hover:underline">
                            {pres.contestName}
                          </Link>
                        ) : (
                          <span>{pres.contestName}</span>
                        )}
                      </h2>
                      <LineupEntryStatusBadge kind={entryStatus.kind} label={entryStatus.label} />
                      {entered && row.safety_coverage_eligible ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-sky-600/25 px-2.5 py-0.5 text-[11px] font-semibold leading-tight tracking-tight text-sky-200 ring-1 ring-sky-500/35">
                          Safety Coverage Eligible
                        </span>
                      ) : null}
                      {entered && row.safety_token_issued ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-600/25 px-2.5 py-0.5 text-[11px] font-semibold leading-tight tracking-tight text-emerald-200 ring-1 ring-emerald-500/40">
                          Safety Coverage Credit Issued
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      Submitted {formatSubmitted(row.created_at)} · Entry {pres.entryFeeLabel}
                      {hasContest ? (
                        <>
                          {" · "}
                          <DashboardStatusBadge status={pres.statusLabel} />
                        </>
                      ) : null}
                    </p>
                    {entered && row.valid_contest_entry && protectionFundUsd > 0 ? (
                      <p className="mt-1.5 text-sm font-medium tabular-nums text-emerald-300/95">
                        Protection fund allocation: {formatSafetyUsd(protectionFundUsd)}
                      </p>
                    ) : null}
                    {missingProtectionSelection ? (
                      <p className="mt-2 inline-flex rounded border border-amber-500/40 bg-amber-950/30 px-2.5 py-1 text-xs font-semibold text-amber-100">
                        Needs protection selection
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums text-emerald-300">
                      Score{" "}
                      <span className="text-white">{row.total_score.toFixed(1)}</span>
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-slate-400">
                      Salary ${row.total_salary.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {hasContest && row.contest_id && row.valid_contest_entry ? (
                    <>
                      <Link
                        href={`/contest/${encodeURIComponent(row.contest_id)}`}
                        className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                      >
                        View Contest
                      </Link>
                      <Link
                        href={`/contest/${encodeURIComponent(row.contest_id)}#leaderboard`}
                        className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                      >
                        View Leaderboard
                      </Link>
                    </>
                  ) : null}
                  {entered ? (
                    <p
                      className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2 text-xs font-medium leading-snug text-slate-500"
                      role="status"
                      aria-label="Lineup locked"
                    >
                      Lineup locked after contest entry.
                    </p>
                  ) : (
                    <Link
                      href={`/lineup?edit=${encodeURIComponent(row.id)}`}
                      className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-emerald-600/60 bg-emerald-900/30 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-sm transition hover:border-emerald-500/80 hover:bg-emerald-900/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      aria-label="Edit draft lineup"
                    >
                      {missingProtectionSelection ? "Complete protection selection" : "Edit lineup"}
                    </Link>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm leading-relaxed text-slate-300">
                    <span className="font-semibold text-slate-400">Roster: </span>
                    {roster || "—"}
                  </p>
                  <div className="mt-2 border-t border-slate-800/80 pt-3">
                    {entered && row.safety_coverage_eligible ? (
                      <p className="text-sm leading-relaxed text-slate-400">
                        Automatic Safety Coverage. If any golfer withdraws before Round 1 lock, your entry receives a
                        Safety Coverage Credit equal to the entry fee.
                        {triggerGolfer ? (
                          <>
                            {" "}
                            Latest trigger:{" "}
                            <span className="font-medium text-slate-200">{triggerGolfer.name}</span>
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">Safety coverage applies when you enter with coverage fees.</p>
                    )}
                  </div>
                  {entered && row.protection_enabled ? (
                    <ul className="space-y-2 text-sm text-slate-200">
                      {row.players.map((p) => (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2"
                          title={undefined}
                        >
                          <span className="min-w-0 flex-1 font-medium text-slate-200">
                            {p.name}
                            {p.withdrawn ? <span className="text-amber-300"> (WD)</span> : null}
                          </span>
                          {p.protected && p.protectionUiStatus && p.protectionUiStatus !== "none" ? (
                            <ProtectionLiveTag
                              status={p.protectionUiStatus}
                              swapAvailableUntil={p.swapAvailableUntil}
                              compact
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {entered &&
                row.protection_enabled &&
                row.contest_id &&
                row.players.some((p) => p.protectionUiStatus === "swap_available") ? (
                  <div className="mt-3 space-y-3">
                    {row.players.map((p) =>
                      p.protectionUiStatus === "swap_available" && p.protected ? (
                        <ProtectionSwapPanel
                          key={`swap-${row.id}-${p.id}`}
                          lineupId={row.id}
                          contestId={row.contest_id!}
                          oldGolferId={p.id}
                          oldGolferName={p.name}
                          currentTotalSalary={row.total_salary}
                          oldGolferSalary={p.salary}
                          onSwapped={() => void refresh()}
                        />
                      ) : null,
                    )}
                  </div>
                ) : null}
                {wdProtected.map((p) => (
                  <ProtectionClaimControls
                    key={`${row.id}-${p.id}`}
                    lineupId={row.id}
                    golferId={p.id}
                    golferName={p.name}
                    contestLabel={pres.contestName}
                    claim={getClaim(row.id, p.id)}
                    onSubmitted={() => {
                      void refresh();
                      void refreshClaims();
                    }}
                  />
                ))}
                {entered && row.contest_id && row.contest_entry_id ? (
                  <ContestLabPanel
                    contestId={row.contest_id}
                    entryId={row.contest_entry_id}
                    lineupId={row.id}
                    players={row.players.map((p) => ({ id: p.id, name: p.name }))}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
