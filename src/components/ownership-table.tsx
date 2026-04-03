import type { GolferOwnershipRow } from "@/lib/contest-golfer-ownership";
import { PremiumGate } from "@/components/premium-gate";

type Props = {
  rows: GolferOwnershipRow[];
  hasPremiumAccess: boolean;
};

/** Field ownership (roster-slot %) for golfers in the contest. */
export function OwnershipTable({ rows, hasPremiumAccess }: Props) {
  return (
    <section className="border-x border-[#2a3039] bg-[#141920] px-4 py-4 sm:px-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Ownership</h2>
      <p className="mt-1 text-xs text-[#6b7684]">
        Share of roster slots across entered lineups (higher % = more popular in this contest).
      </p>
      <PremiumGate hasAccess={hasPremiumAccess} className="mt-4">
        <div className="overflow-x-auto rounded-lg border border-[#2a3039] bg-[#0f1419]">
          <table className="w-full min-w-[420px] border-collapse text-left text-sm">
            <caption className="sr-only">Golfer ownership percentages</caption>
            <thead>
              <tr className="border-b border-[#2a3039] bg-[#1a1f26] text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
                <th className="px-4 py-3 pl-5 sm:px-5">Golfer</th>
                <th className="px-3 py-3 text-right">Slots</th>
                <th className="px-4 py-3 pr-5 text-right sm:px-5">Ownership</th>
              </tr>
            </thead>
            <tbody className="text-[#e8ecf0]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[#6b7684]">
                    No entered lineups yet — ownership appears after players lock in.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr
                    key={row.golferId}
                    className={`border-b border-[#232a33] ${i % 2 === 0 ? "bg-[#0f1419]" : "bg-[#0c1015]"}`}
                  >
                    <td className="px-4 py-3 pl-5 font-medium text-white sm:px-5">{row.golferName}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#c5cdd5]">{row.rosterSlots}</td>
                    <td className="px-4 py-3 pr-5 text-right font-semibold tabular-nums text-[#53d769] sm:px-5">
                      {row.ownershipPct.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PremiumGate>
    </section>
  );
}
