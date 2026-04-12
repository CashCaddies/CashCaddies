import { PayoutHistoryPanel } from "@/components/payout-history-panel";
import { getPayoutHistory } from "@/lib/admin/get-payout-history";
import { getPayoutRowSummary } from "@/lib/admin/payout-summary";

type Props = {
  contestId: string;
};

/** Embedded on settlement admin: full payout table without URL filter bar (shows all rows). */
export async function AdminPayoutHistoryTable({ contestId }: Props) {
  const result = await getPayoutHistory(contestId);

  if (!result.ok) {
    return (
      <p className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">{result.error}</p>
    );
  }

  if (result.rows.length === 0) {
    return (
      <p className="text-sm text-[#8b98a5]">
        No rows in <span className="font-mono text-[#c5cdd5]">contest_entry_results</span> for this contest yet.
      </p>
    );
  }

  return (
    <PayoutHistoryPanel
      contestId={contestId}
      rows={result.rows}
      walletCreditedAt={result.walletCreditedAt}
      summary={getPayoutRowSummary(result.rows)}
      activeFilter="all"
      showFilterBar={false}
    />
  );
}
