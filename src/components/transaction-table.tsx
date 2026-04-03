"use client";

import type { WalletTransaction } from "@/lib/wallet-transaction";
import { formatMoney } from "@/lib/wallet";

function formatTxDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  transactions: WalletTransaction[];
};

export function TransactionTable({ transactions }: Props) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  if (!sorted.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30 px-4 py-12 text-center">
        <p className="text-sm text-slate-500">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60">
              <th scope="col" className="px-4 py-3 font-semibold text-slate-400">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-slate-400">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-slate-400">
                Amount
              </th>
              <th scope="col" className="px-4 py-3 font-semibold text-slate-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const positive = row.amount >= 0;
              return (
                <tr
                  key={row.id}
                  className="border-b border-slate-800/80 last:border-0 transition-colors hover:bg-slate-800/30"
                >
                  <td className="px-4 py-3.5 tabular-nums text-slate-300">{formatTxDate(row.date)}</td>
                  <td className="px-4 py-3.5 text-slate-200">{row.type}</td>
                  <td
                    className={`px-4 py-3.5 text-right font-semibold tabular-nums ${
                      positive
                        ? "text-[#ffd700] [text-shadow:0_0_12px_rgba(255,215,0,0.22)]"
                        : "text-red-400/95"
                    }`}
                  >
                    {positive ? "+" : "−"}
                    {formatMoney(Math.abs(row.amount))}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-200/90">
                      {row.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
