import Link from "next/link";
import type { ContestPayoutRow } from "@/lib/contest-lobby-fetch";
import type { LobbyContestRow } from "@/lib/contest-lobby-shared";
import {
  formatContestStartDate,
  formatLobbyEntryFeeUsd,
  formatPerUserEntryLimit,
} from "@/lib/contest-lobby-shared";
import { SALARY_CAP } from "@/lib/contest-lobby-data";

type Props = {
  contestId: string;
  row: LobbyContestRow;
  payouts: ContestPayoutRow[];
};

export function ContestDbDetail({ contestId, row, payouts }: Props) {
  const max = Math.max(1, row.max_entries);
  const current = Math.min(row.entry_count || 0, max);
  const fillPct = Math.min(100, (current / max) * 100);
  const perUser = formatPerUserEntryLimit(row.max_entries_per_user);
  const prizePoolLabel =
    row.prize_pool != null && row.prize_pool !== ""
      ? formatLobbyEntryFeeUsd(row.prize_pool)
      : "—";

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Contest</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{row.name}</h1>
          {perUser ? (
            <span className="shrink-0 rounded border border-[#3d4550] bg-[#1a1f26] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#a8b4c0]">
              {perUser}
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Entry Fee</dt>
            <dd className="mt-1 text-lg font-semibold text-white">{formatLobbyEntryFeeUsd(row.entry_fee_usd)}</dd>
          </div>
          <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Prize pool</dt>
            <dd className="mt-1 text-lg font-bold text-[#53d769]">{prizePoolLabel}</dd>
            <p className="mt-1 text-[11px] text-[#6b7684]">Entry fee × current entries</p>
          </div>
          <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Max entries</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{row.max_entries.toLocaleString()}</dd>
          </div>
          <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Start</dt>
            <dd className="mt-1 text-lg font-medium text-[#e8ecf0]">{formatContestStartDate(row.starts_at)}</dd>
          </div>
        </dl>

        <div className="mt-6 rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Entries</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-lg font-semibold tabular-nums text-white">
              {current.toLocaleString()} / {max.toLocaleString()}
            </span>
            <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[#2a3039] sm:max-w-xs">
              <div
                className="h-full rounded-full bg-[#3d8bfd]/90"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {payouts.length === 0 ? (
        <div className="border-x border-[#2a3039] bg-[#0c1015] px-4 py-6 sm:px-8">
          <h2 className="text-lg font-bold uppercase tracking-wide text-[#c5cdd5]">Prize breakdown</h2>
          <p className="mt-2 text-sm text-[#6b7684]">No payout structure</p>
        </div>
      ) : (
        <div className="border-x border-[#2a3039] bg-[#0c1015] px-4 py-6 sm:px-8">
          <h2 className="text-lg font-bold uppercase tracking-wide text-[#c5cdd5]">Prize breakdown</h2>
          <p className="mt-1 text-sm text-[#6b7684]">Share of prize pool by finish (top {payouts.length}).</p>
          <ul className="mt-4 divide-y divide-[#232a33] rounded-lg border border-[#2a3039] bg-[#0f1419]">
            {payouts.map((p) => (
              <li
                key={p.rank_place}
                className="flex items-center justify-between px-4 py-3 text-sm sm:text-base"
              >
                <span className="font-medium text-[#e8ecf0]">Place {p.rank_place}</span>
                <span className="font-bold tabular-nums text-[#53d769]">{Number(p.payout_pct).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-x border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        <h2 className="text-lg font-bold uppercase tracking-wide text-[#c5cdd5]">Rules</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[#c5cdd5]">
          <li>Build a lineup of 6 golfers under the salary cap.</li>
          <li>
            Salary cap:{" "}
            <span className="font-semibold text-white">${SALARY_CAP.toLocaleString()}</span>.
          </li>
          <li>Lineups lock at contest start. Highest total fantasy points wins.</li>
        </ul>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#141920] px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link
            href={`/contest/${encodeURIComponent(contestId)}`}
            className="inline-flex min-w-[12rem] items-center justify-center rounded border border-[#2f3640] bg-[#1c2128] px-8 py-3 text-base font-bold uppercase tracking-wide text-[#e8ecf0] shadow-sm hover:bg-[#232a33]"
          >
            Leaderboard
          </Link>
          <Link
            href={`/lobby/${encodeURIComponent(contestId)}/enter`}
            className="inline-flex min-w-[12rem] items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-8 py-3 text-base font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#249544] active:bg-[#1c7a34]"
          >
            Enter Contest
          </Link>
          <Link
            href={`/lineup?contest=${encodeURIComponent(contestId)}`}
            className="inline-flex min-w-[12rem] items-center justify-center rounded border border-[#3d4550] bg-[#1c2128] px-8 py-3 text-base font-bold uppercase tracking-wide text-[#e8ecf0] shadow-sm hover:bg-[#232a33]"
          >
            Build Lineup
          </Link>
        </div>
      </div>
    </div>
  );
}
