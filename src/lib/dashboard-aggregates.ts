import {
  type DashboardLineup,
  dashboardLineupContestPresentation,
} from "./dashboard-lineups";
import { getContestDisplay } from "./contest-lobby-data";

const UNASSIGNED_CONTEST_KEY = "__unassigned__";

function lineupAmountPaidUsd(l: DashboardLineup): number {
  if (l.total_paid > 0) return l.total_paid;
  // Single entry fee (protection is not an add-on); do not sum legacy protection_fee onto entry_fee.
  if (l.entry_fee > 0) return l.entry_fee;
  if (l.contest?.entry_fee_usd != null && Number.isFinite(l.contest.entry_fee_usd)) {
    return l.contest.entry_fee_usd;
  }
  return getContestDisplay(l.contest_id).feeNumber;
}

export type EnteredContestRow = {
  contestId: string;
  name: string;
  entryFee: string;
  status: string;
  lineupCount: number;
  totalEntryFeesUsd: number;
};

export function aggregateEnteredContests(lineups: DashboardLineup[]): EnteredContestRow[] {
  const byContest = new Map<string, { lineupCount: number; paidSum: number }>();
  for (const l of lineups) {
    const key = l.contest_id ?? UNASSIGNED_CONTEST_KEY;
    const prev = byContest.get(key) ?? { lineupCount: 0, paidSum: 0 };
    const paid = lineupAmountPaidUsd(l);
    byContest.set(key, {
      lineupCount: prev.lineupCount + 1,
      paidSum: prev.paidSum + paid,
    });
  }
  return Array.from(byContest.entries())
    .map(([key, { lineupCount, paidSum }]) => {
      if (key === UNASSIGNED_CONTEST_KEY) {
        return {
          contestId: "",
          name: "Draft",
          entryFee: "—",
          status: "Draft",
          lineupCount,
          totalEntryFeesUsd: paidSum,
        };
      }
      const sample = lineups.find((l) => l.contest_id === key);
      const pres = sample ? dashboardLineupContestPresentation(sample) : null;
      const fallback = getContestDisplay(key);
      return {
        contestId: key,
        name: pres?.contestName ?? fallback.name,
        entryFee: pres?.entryFeeLabel ?? fallback.entryFee,
        status: pres?.statusLabel ?? fallback.status,
        lineupCount,
        totalEntryFeesUsd: paidSum,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function totalEntryFeesUsd(lineups: DashboardLineup[]): number {
  return lineups.reduce((sum, l) => sum + lineupAmountPaidUsd(l), 0);
}
