"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardStatusBadge } from "@/components/dashboard-status-badge";
import { ProtectedEntryBadge } from "@/components/protected-golfer-indicators";
import { useMyContestEntries } from "@/hooks/use-my-contest-entries";

function formatUsd(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function formatEnteredAt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function MyContestsPage() {
  const router = useRouter();
  const { user, rows, error, loading, sessionResolved } = useMyContestEntries();

  return (
    <DashboardShell
      title="My Contests"
      description="Contests you have entered, from your contest_entries ledger in Supabase."
    >
      {loading && <p className="text-slate-400">Loading…</p>}
      {error && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">{error}</p>
      )}
      {sessionResolved && !loading && !user && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Sign in
          </Link>{" "}
          to see your contests.
        </p>
      )}

      {sessionResolved && user && !loading && (
        <div className="goldCard goldCardStatic overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <caption className="sr-only">Contests you have entered</caption>
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Contest</th>
                <th className="px-4 py-3">Entry fee</th>
                <th className="px-4 py-3 text-right">Lineup salary</th>
                <th className="px-4 py-3">Protection fund (5% of entry)</th>
                <th className="px-4 py-3">Contest status</th>
                <th className="px-4 py-3 text-right">Entered</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    You have not entered any contests yet.{" "}
                    <Link href="/lobby" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
                      Go to lobby
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const contestHref = `/contest/${encodeURIComponent(r.contestId)}`;
                return (
                  <tr
                    key={r.entryId}
                    role="link"
                    tabIndex={0}
                    aria-label={`View contest ${r.contestName}`}
                    className="cursor-pointer hover:bg-slate-950/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500/80"
                    onClick={() => router.push(contestHref)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(contestHref);
                      }
                    }}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{r.contestName}</span>
                        <span className="text-sm font-normal text-slate-400">Entry #{r.entryNumber}</span>
                        {r.hasProtectedEntry ? <ProtectedEntryBadge /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-slate-300">{formatUsd(r.entryFeeUsd)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                      {r.lineupSalary !== null ? `$${r.lineupSalary.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {r.entryFeeUsd > 0 ? (
                        <span className="tabular-nums text-emerald-200/90">{formatUsd(r.protectionFeeUsd)}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <DashboardStatusBadge status={r.contestStatus} />
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-slate-500">{formatEnteredAt(r.enteredAt)}</td>
                    <td
                      className="px-4 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link
                        href={contestHref}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-700"
                      >
                        View Contest
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
