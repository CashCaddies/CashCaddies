"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";

export type WinningsRow = {
  id: string;
  contest_id: string;
  rank: number;
  winnings_usd: number;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
};

type Props = {
  rows: WinningsRow[];
  paidTotal: number;
  loadError: string | null;
};

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WinningsView({ rows, paidTotal, loadError }: Props) {
  return (
    <DashboardShell
      title="My Winnings"
      description="Prize amounts from contests you placed in, after payouts are calculated."
    >
      {loadError ? (
        <p className="rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="goldCard p-6">
        <p className="text-sm font-medium text-slate-400">Paid total (credited to wallet)</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-white">{formatMoney(paidTotal)}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/40">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm text-slate-200">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/80 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Contest</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3 text-right">Winnings</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No payout results yet. When a contest finishes and payouts run, your placements appear here.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-800/90 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contest/${encodeURIComponent(row.contest_id)}`}
                      className="font-mono text-sm text-emerald-400/95 underline-offset-2 hover:underline"
                    >
                      {row.contest_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white">{row.rank}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-white">
                    {`$${Number(row.winnings_usd || 0).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3">
                    {row.paid ? (
                      <span className="text-emerald-300">Paid</span>
                    ) : (
                      <span className="text-amber-200/90">Pending</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
