"use client";

import { useEffect, useRef, useState } from "react";
import type { GolferOwnershipRow } from "@/lib/contest-golfer-ownership";
import type { LeaderboardDisplayRow } from "@/lib/contest-leaderboard-data";
import { ContestLeaderboardTable } from "@/components/contest-leaderboard-table";
import { GolfLeaderboard } from "@/components/golf-leaderboard";
import { LeaderboardSimulateScoring } from "@/components/leaderboard-simulate-scoring";
import { OwnershipTable } from "@/components/ownership-table";
import type { DfsPremiumViewer } from "@/lib/dfs-premium-viewer";
import type { GolferLeaderboardRow } from "@/lib/leaderboard";

type Props = {
  /** `contests.id` (UUID) — must match DB primary key for RPCs */
  contest: { id: string; current_round?: number };
  initialRows: LeaderboardDisplayRow[];
  initialGolferRows: GolferLeaderboardRow[];
  showSimulate: boolean;
  dfsPremiumViewer: DfsPremiumViewer;
  initialOwnershipRows: GolferOwnershipRow[];
};

/** Holds leaderboard rows in client state so we can replace them immediately after simulate + server refetch. */
export function ContestLeaderboardBlock({
  contest,
  initialRows,
  initialGolferRows,
  showSimulate,
  dfsPremiumViewer,
  initialOwnershipRows,
}: Props) {
  const [rows, setRows] = useState<LeaderboardDisplayRow[]>(initialRows);
  const [golferRows, setGolferRows] = useState<GolferLeaderboardRow[]>(initialGolferRows);
  const [ownershipRows, setOwnershipRows] = useState<GolferOwnershipRow[]>(initialOwnershipRows);
  const prevContestId = useRef(contest.id);

  useEffect(() => {
    const contestChanged = prevContestId.current !== contest.id;
    if (contestChanged) {
      prevContestId.current = contest.id;
    }
    // When switching contests, always take server data. Same contest: only replace when server returned rows,
    // so a transient [] from RSC does not hide rows we already have (e.g. after refetch/simulate).
    if (contestChanged || initialRows.length > 0) {
      setRows(initialRows);
    }
    if (contestChanged || initialGolferRows.length > 0) {
      setGolferRows(initialGolferRows);
    }
    if (contestChanged || initialOwnershipRows.length > 0) {
      setOwnershipRows(initialOwnershipRows);
    }
  }, [contest.id, initialRows, initialGolferRows, initialOwnershipRows]);

  const hasPremiumTools = dfsPremiumViewer.hasPremiumToolsAccess;
  const contestRound = { current_round: contest.current_round ?? 0 };

  const statusBadges =
    hasPremiumTools && (dfsPremiumViewer.isPremiumSubscriber || dfsPremiumViewer.isDfsBetaTester) ? (
      <>
        {dfsPremiumViewer.isPremiumSubscriber ? (
          <span
            className="inline-flex items-center gap-0.5 rounded border border-amber-500/45 bg-amber-950/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-100"
            title="Premium member"
          >
            <span aria-hidden="true">👑</span>
            Premium
          </span>
        ) : null}
        {dfsPremiumViewer.isDfsBetaTester ? (
          <span
            className="inline-flex items-center rounded border border-sky-500/45 bg-sky-950/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sky-100"
            title="DFS beta tester"
          >
            Beta
          </span>
        ) : null}
      </>
    ) : null;

  return (
    <>
      <GolfLeaderboard
        rows={golferRows}
        hasPremiumToolsAccess={hasPremiumTools}
        statusBadges={statusBadges}
        contest={contestRound}
      />

      <OwnershipTable rows={ownershipRows} hasPremiumAccess={hasPremiumTools} />

      {showSimulate && (
        <div className="border-x border-[#2a3039] bg-[#141920] px-4 py-4 sm:px-6">
          <LeaderboardSimulateScoring
            contest={contest}
            onLeaderboardRefetched={(data) => {
              setRows(data.rows);
            }}
            onGolferLeaderboardRefetched={(data) => {
              setGolferRows(data.rows);
            }}
          />
        </div>
      )}

      <ContestLeaderboardTable rows={rows} contest={contestRound} />
    </>
  );
}
