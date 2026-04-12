import Link from "next/link";
import type { PayoutHistoryRow } from "@/lib/admin/get-payout-history";
import type { PayoutRowSummary } from "@/lib/admin/payout-summary";
import { formatPayoutUserDisplay } from "@/lib/admin/payout-profile-display";

type PaidFilter = "all" | "paid" | "unpaid";

function filterHref(contestId: string, filter: PaidFilter): string {
  const p = new URLSearchParams({ contestId });
  if (filter === "paid") p.set("paid", "true");
  if (filter === "unpaid") p.set("paid", "false");
  return `/admin/payout-history?${p.toString()}`;
}

function filterLinkClass(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "bg-emerald-600/25 text-emerald-100 ring-1 ring-emerald-500/40"
      : "text-[#8b98a5] hover:bg-[#141920] hover:text-[#c5cdd5]"
  }`;
}

type Props = {
  contestId: string;
  rows: PayoutHistoryRow[];
  walletCreditedAt: string | null;
  summary: PayoutRowSummary;
  activeFilter: PaidFilter;
  showFilterBar?: boolean;
};

export function PayoutHistoryPanel({
  contestId,
  rows,
  walletCreditedAt,
  summary,
  activeFilter,
  showFilterBar = true,
}: Props) {
  const unpaidRows = summary.totalRows - summary.totalPaid;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#2a3039] bg-[#141920] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Rows</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{summary.totalRows}</p>
        </div>
        <div className="rounded-xl border border-[#2a3039] bg-[#141920] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Total winnings</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">${summary.totalAmount.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-[#2a3039] bg-[#141920] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Paid rows</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300/95">{summary.totalPaid}</p>
        </div>
        <div className="rounded-xl border border-[#2a3039] bg-[#141920] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Unpaid rows</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200/90">{unpaidRows}</p>
        </div>
      </div>

      {walletCreditedAt ? (
        <p className="text-sm text-[#8b98a5]">
          Contest wallet run: <span className="font-mono text-[#c5cdd5]">{walletCreditedAt}</span>
        </p>
      ) : (
        <p className="text-sm text-amber-200/85">No row in contest_winnings_credits yet (full pipeline not completed).</p>
      )}

      {showFilterBar ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#6b7684]">Show</span>
          <Link href={filterHref(contestId, "all")} className={filterLinkClass(activeFilter === "all")}>
            All
          </Link>
          <Link href={filterHref(contestId, "paid")} className={filterLinkClass(activeFilter === "paid")}>
            Paid
          </Link>
          <Link href={filterHref(contestId, "unpaid")} className={filterLinkClass(activeFilter === "unpaid")}>
            Unpaid
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#2a3039] bg-[#141920]/50">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a3039] bg-[#141920] text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3 text-right">Winnings</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Paid at</th>
              <th className="hidden px-4 py-3 lg:table-cell">Recorded</th>
            </tr>
          </thead>
          <tbody className="text-[#c5cdd5]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#8b98a5]">
                  No rows match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const label = formatPayoutUserDisplay(row.profiles);
                return (
                  <tr key={row.id} className="border-b border-[#2a3039]/70 last:border-0">
                    <td className="px-4 py-3 font-mono tabular-nums text-white">{row.rank}</td>
                    <td className="max-w-[min(100vw,22rem)] px-4 py-3">
                      <div className="font-medium text-white">{label.primary}</div>
                      {label.secondary ? (
                        <div className="mt-0.5 text-xs text-[#8b98a5]">{label.secondary}</div>
                      ) : null}
                      <div className="mt-1 font-mono text-[10px] text-[#6b7684] lg:hidden">{row.user_id}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-white">
                      ${Number(row.winnings_usd).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.paid ? (
                        <span className="inline-flex rounded-full bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-600/35">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-800/80 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-600/40">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#8b98a5]">{row.paid_at ?? "—"}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-[#6b7684] lg:table-cell">{row.created_at}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
