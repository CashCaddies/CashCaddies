import type { LeaderboardDisplayRow } from "@/lib/contest-leaderboard-data";
import { ENTRY_PROTECTED_TOOLTIP } from "@/lib/entry-protection";
import Link from "next/link";

type Props = {
  rows: LeaderboardDisplayRow[];
};

/** Each row: `profiles.username` + `contest_entries.entry_number` as "username Entry #n". */
export function ContestLeaderboardTable({ rows }: Props) {
  return (
    <section className="border-x border-b border-[#2a3039] bg-[#141920] px-4 py-4 sm:px-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Leaderboard</h2>
        <p className="mt-1 text-xs text-[#6b7684]">
        Ordered by total score (highest first), then earliest entry time, then entry id — same tie-break as payouts. Status
        reflects Safety Coverage credits and post–Round-1 scoring adjustments.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-[#2a3039] bg-[#0f1419]">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            Contest leaderboard: rank, user, total salary, total score, protection, safety coverage. Sorted by total score
            descending.
          </caption>
          <thead>
            <tr className="border-b border-[#2a3039] bg-[#1a1f26] text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              <th className="w-[8%] px-4 py-3 pl-5 sm:px-5">Rank</th>
              <th className="w-[26%] px-3 py-3">User</th>
              <th className="w-[13%] px-3 py-3 text-right">Total salary</th>
              <th className="w-[13%] px-3 py-3 text-right">Total score</th>
              <th className="w-[18%] px-3 py-3 text-center">Protection Status</th>
              <th className="w-[22%] px-4 py-3 pr-5 text-right sm:px-5">CashCaddies Safety Coverage</th>
            </tr>
          </thead>
          <tbody className="text-[#e8ecf0]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#6b7684]">
                  No entries for this contest yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const userEntryLabel = `${row.userLabel} Entry #${row.entryNumber}`;
                const isProtectedRow = row.protectionTriggered || row.protectionTokenIssued;
                const protectionTooltip = row.protectionTokenIssued
                  ? row.protectedGolferName
                    ? `Safety Coverage Credit issued — ${row.protectedGolferName}`
                    : "Safety Coverage Credit issued"
                  : row.protectionTriggered
                    ? row.protectedGolferName
                      ? `Scoring adjustment — ${row.protectedGolferName}`
                      : "Scoring adjustment (post–Round-1 WD/DQ)"
                    : undefined;
                return (
                <tr
                  key={row.lineupId ?? `row-${row.rank}-${row.userId}-${row.entryNumber}`}
                  className={`border-b border-[#232a33] ${
                    isProtectedRow
                      ? "bg-emerald-950/35"
                      : (row.rank - 1) % 2 === 0
                        ? "bg-[#0f1419]"
                        : "bg-[#0c1015]"
                  }`}
                >
                  <td className="px-4 py-3.5 pl-5 align-middle tabular-nums sm:px-5">
                    <span className="font-bold text-white">{row.rank}</span>
                  </td>
                  <td className="max-w-0 px-3 py-3.5 align-middle">
                    <div
                      className="flex min-w-0 items-center gap-1.5 truncate font-medium text-white"
                      title={userEntryLabel}
                    >
                      {row.entryFeeProtected ? (
                        <span
                          className="inline-flex shrink-0 text-sky-300"
                          title={ENTRY_PROTECTED_TOOLTIP}
                          aria-label="Entry fee protected"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden
                          >
                            <path
                              fillRule="evenodd"
                              d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.75.75 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143-.001c-2.996 0-5.723-1.387-7.834-3.604ZM15.75 9.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      ) : null}
                      <span className="min-w-0 truncate text-white">{row.userLabel}</span>
                      <Link
                        href={`/lineup?entryId=${encodeURIComponent(row.entryId)}`}
                        className="text-[#8b98a5] hover:text-[#7ab8ff] hover:underline"
                        aria-label={`View/edit ${row.userLabel} Entry #${row.entryNumber}`}
                      >
                        {" "}
                        Entry #{row.entryNumber}
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 align-middle text-right tabular-nums text-[#c5cdd5]">
                    ${row.totalSalary.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5 align-middle text-right tabular-nums font-bold text-[#53d769]">
                    {Number.isFinite(row.totalScore) ? row.totalScore.toFixed(1) : "0.0"}
                  </td>
                  <td className="px-3 py-3.5 text-center align-middle">
                    {isProtectedRow || row.protectionStatusLabel !== "Standard" ? (
                      <span
                        className={`inline-flex cursor-help items-center justify-center gap-1.5 text-[13px] font-semibold ${
                          row.protectionTokenIssued ? "text-emerald-200/95" : "text-[#c5cdd5]"
                        }`}
                        title={protectionTooltip}
                        aria-label={row.protectionStatusLabel}
                      >
                        {row.protectionStatusLabel}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#8b98a5]">{row.protectionStatusLabel}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 pr-5 text-right align-middle sm:px-5">
                    {row.protectionEnabled ? (
                      <span className="font-semibold text-[#53d769]">Yes</span>
                    ) : (
                      <span className="text-[#6b7684]">No</span>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
