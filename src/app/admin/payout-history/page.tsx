import Link from "next/link";
import { getPayoutHistory, type PayoutHistoryRow } from "@/lib/admin/get-payout-history";
import { formatPayoutUserDisplay } from "@/lib/admin/payout-profile-display";

type PageProps = {
  searchParams: Promise<{ contestId?: string; paid?: string }>;
};

function filterHref(contestId: string, paid?: "true" | "false") {
  const q = new URLSearchParams({ contestId });
  if (paid === "true") q.set("paid", "true");
  if (paid === "false") q.set("paid", "false");
  return `/admin/payout-history?${q.toString()}`;
}

export default async function PayoutHistoryPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const contestId = typeof sp.contestId === "string" ? sp.contestId.trim() : "";

  const paidFilter =
    sp.paid === "true" ? true : sp.paid === "false" ? false : undefined;

  if (!contestId) {
    return (
      <div className="border-b border-[#2a3039] bg-[#0f1419] p-6">
        <h1 className="text-xl font-bold text-white">Payout history</h1>
        <p className="mt-2 text-sm text-[#8b98a5]">
          Missing <span className="font-mono">contestId</span>. Open from{" "}
          <Link href="/admin/settlement" className="text-emerald-400/90 underline hover:text-emerald-300">
            Contest settlement
          </Link>{" "}
          or add <span className="font-mono">?contestId=…</span> to the URL.
        </p>
      </div>
    );
  }

  const result = await getPayoutHistory(contestId, { paid: paidFilter });

  if (!result.ok) {
    return (
      <div className="border-b border-[#2a3039] bg-[#0f1419] p-6">
        <h1 className="text-xl font-bold text-white">Payout history</h1>
        <p className="mt-4 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{result.error}</p>
        <p className="mt-4 text-sm">
          <Link href="/admin/settlement" className="text-emerald-400/90 underline hover:text-emerald-300">
            ← Back to settlement
          </Link>
        </p>
      </div>
    );
  }

  const data = result.rows;

  const summary = {
    totalRows: data.length,
    totalPaid: data.filter((d) => d.paid).length,
    totalAmount: data.reduce((s, d) => s + Number(d.winnings_usd), 0),
  };

  return (
    <div className="border-b border-[#2a3039] bg-[#0f1419] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
      <h1 className="mb-4 mt-2 text-xl font-bold text-white">Payout history</h1>
      <p className="mb-4 font-mono text-xs text-[#8b98a5]">{contestId}</p>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href={filterHref(contestId)}
          className="rounded-md border border-[#2a3039] bg-[#141920] px-3 py-1.5 text-[#c5cdd5] hover:border-emerald-600/40 hover:text-white"
        >
          All
        </Link>
        <Link
          href={filterHref(contestId, "true")}
          className="rounded-md border border-[#2a3039] bg-[#141920] px-3 py-1.5 text-[#c5cdd5] hover:border-emerald-600/40 hover:text-white"
        >
          Paid
        </Link>
        <Link
          href={filterHref(contestId, "false")}
          className="rounded-md border border-[#2a3039] bg-[#141920] px-3 py-1.5 text-[#c5cdd5] hover:border-emerald-600/40 hover:text-white"
        >
          Unpaid
        </Link>
        <a
          href={`/api/admin/export-payouts?contestId=${encodeURIComponent(contestId)}`}
          className="rounded bg-blue-600 px-3 py-1 text-white"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-4 space-y-1 text-sm text-[#c5cdd5]">
        <div>Total rows: {summary.totalRows}</div>
        <div>Paid entries: {summary.totalPaid}</div>
        <div>Total winnings: ${summary.totalAmount.toFixed(2)}</div>
        {result.walletCreditedAt ? (
          <div className="text-[#8b98a5]">
            Contest wallet credited: <span className="font-mono">{result.walletCreditedAt}</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#2a3039]">
        <table className="w-full min-w-[520px] border-collapse text-sm text-[#c5cdd5]">
          <thead>
            <tr className="border-b border-[#2a3039] bg-[#141920] text-left text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2 text-right">Winnings</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2">Paid at</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[#8b98a5]">
                  No rows for this filter.
                </td>
              </tr>
            ) : (
              data.map((row: PayoutHistoryRow) => {
                const userLabel = formatPayoutUserDisplay(row.profiles);
                return (
                  <tr key={row.id} className="border-b border-[#2a3039]/80">
                    <td className="px-3 py-2 font-mono text-white">{row.rank}</td>
                    <td className="max-w-xs px-3 py-2">
                      <div className="font-medium text-white">{userLabel.primary}</div>
                      {userLabel.secondary ? (
                        <div className="text-xs text-[#8b98a5]">{userLabel.secondary}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-white">${Number(row.winnings_usd).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-sm">
                      {row.paid ? <span className="text-emerald-300">Paid</span> : <span className="text-amber-200/90">Unpaid</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#8b98a5]">{row.paid_at ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-sm">
        <Link href="/admin/settlement" className="text-emerald-400/90 underline hover:text-emerald-300">
          ← Back to settlement
        </Link>
        {" · "}
        <Link href={filterHref(contestId)} className="text-emerald-400/90 underline hover:text-emerald-300">
          Refresh
        </Link>
      </p>
    </div>
  );
}
