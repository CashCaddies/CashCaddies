"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardStatusBadge } from "@/components/dashboard-status-badge";
import { DevTestFundsButton } from "@/components/dev-test-funds-button";
import { ProtectionActivitySection } from "@/components/protection-activity-section";
import { ProtectionNotificationBanner } from "@/components/protection-notification-banner";
import { aggregateEnteredContests, totalEntryFeesUsd } from "@/lib/dashboard-aggregates";
import { dashboardLineupContestPresentation } from "@/lib/dashboard-lineups";
import { useDashboardLineups } from "@/hooks/use-dashboard-lineups";
import { useWallet } from "@/hooks/use-wallet";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { formatMoney } from "@/lib/wallet";
import { isAdmin } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

function formatUsd(n: number) {
  if (n <= 0) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

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

export default function DashboardOverviewPage() {
  const { user, lineups, error, loading } = useDashboardLineups();
  const { wallet, fullUser, loading: walletLoading, refresh: refreshWallet } = useWallet();
  const [safetyFundBalance, setSafetyFundBalance] = useState<number | null>(null);

  const loadSafetyFund = useCallback(async () => {
    if (!supabase) return;
    const { usd } = await fetchInsurancePoolBalanceUsd(supabase);
    setSafetyFundBalance(usd);
  }, []);

  useEffect(() => {
    void loadSafetyFund();
  }, [loadSafetyFund]);

  const isAdminUser = isAdmin(fullUser?.role);
  const contests = aggregateEnteredContests(lineups);
  const walletBalance = wallet?.account_balance ?? 0;
  const enteredContestCount = contests.filter((c) => c.contestId !== "").length;
  const feesTotal = totalEntryFeesUsd(lineups);

  return (
    <DashboardShell
      title="Dashboard"
      description="Entered contests, submitted lineups, entry fees, and contest status — synced from your account."
      dashboardNavMode="dashboard"
    >
      {loading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">{error}</p>}
      {!loading && !user && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Sign in
          </Link>{" "}
          to see your contests and lineups from Supabase.
        </p>
      )}

      {user && !loading && (
        <>
          <div className="dashboardTopBar">
            <div className="fundCard goldCard">
              <h4>Safety Coverage Fund</h4>
              <p className="fundAmount">{formatMoney(safetyFundBalance ?? 0)}</p>
              <p className="fundNote">Funded by protected entries</p>
            </div>
            <div className="walletCard">
              <h4>Beta Wallet</h4>
              <p className="walletAmount">{walletLoading ? "…" : formatMoney(walletBalance)}</p>
              <p className="walletNote">Testing funds only</p>
            </div>
          </div>

          <ProtectionNotificationBanner />

          {process.env.NODE_ENV === "development" && user ? (
            <DevTestFundsButton onSuccess={() => void refreshWallet()} />
          ) : null}

          <ProtectionActivitySection />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="goldCard p-5">
              <p className="text-sm font-medium text-slate-400">Entered contests</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{enteredContestCount}</p>
            </div>
            <div className="goldCard p-5">
              <p className="text-sm font-medium text-slate-400">Submitted lineups</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-white">{lineups.length}</p>
            </div>
            <div className="goldCard p-5">
              <p className="text-sm font-medium text-slate-400">Total entry fees</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-300">{formatUsd(feesTotal)}</p>
            </div>
          </div>

          <div className="goldCard goldCardStatic overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Your submitted lineups</caption>
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Contest</th>
                  <th className="px-4 py-3">Entry fee</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Total salary</th>
                  <th className="px-4 py-3 text-right">Golfers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {lineups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No lineups yet.{" "}
                      <Link href="/lobby" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
                        Browse the lobby
                      </Link>{" "}
                      to enter.
                    </td>
                  </tr>
                )}
                {lineups.map((row) => {
                  const pres = dashboardLineupContestPresentation(row);
                  const hasContest = Boolean(row.contest_id);
                  return (
                    <tr key={row.id} className="hover:bg-slate-950/80">
                      <td className="px-4 py-3.5">
                        {hasContest && row.contest_id ? (
                          <Link
                            href={`/contest/${encodeURIComponent(row.contest_id)}`}
                            className="font-semibold text-white hover:underline"
                          >
                            {pres.contestName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-white">{pres.contestName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-300">{pres.entryFeeLabel}</td>
                      <td className="px-4 py-3.5">
                        <DashboardStatusBadge status={pres.statusLabel} />
                      </td>
                      <td className="px-4 py-3.5 text-slate-400">{formatSubmitted(row.created_at)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-300">
                        {row.total_score.toFixed(1)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-200">
                        ${row.total_salary.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-slate-400">{row.players.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isAdminUser ? (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-white">Admin Tools</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <article className="goldCard p-5">
                  <h3 className="text-base font-semibold text-white">Beta Approvals</h3>
                  <p className="mt-2 text-sm text-slate-400">Approve or review beta users</p>
                  <Link
                    href="/dashboard/beta-users"
                    className="mt-4 inline-flex rounded-md border border-emerald-600/60 bg-emerald-900/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/45"
                  >
                    Manage Beta →
                  </Link>
                </article>

                <article className="goldCard p-5">
                  <h3 className="text-base font-semibold text-white">Create Contest</h3>
                  <p className="mt-2 text-sm text-slate-400">Create contests for lobby</p>
                  <Link
                    href="/admin/contests"
                    className="mt-4 inline-flex rounded-md border border-emerald-600/60 bg-emerald-900/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/45"
                  >
                    Create Contest →
                  </Link>
                </article>

                <article className="goldCard p-5">
                  <h3 className="text-base font-semibold text-white">Beta Stats</h3>
                  <p className="mt-2 text-sm text-slate-400">View beta counts and activity</p>
                  <Link
                    href="/closed-beta"
                    className="mt-4 inline-flex rounded-md border border-emerald-600/60 bg-emerald-900/30 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-900/45"
                  >
                    View Stats →
                  </Link>
                </article>
              </div>
            </section>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}
