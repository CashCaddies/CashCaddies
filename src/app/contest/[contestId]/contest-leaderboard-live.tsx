"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContestLeaderboardRow } from "@/lib/supabase/queries/getContestLeaderboard";
import { Round1LineupPerformance } from "@/app/contest/[contestId]/round1-lineup-performance";
import { CONTEST_LEADERBOARD_POLL_MS, pollContestLeaderboard } from "./leaderboard-poll-action";

type Props = {
  contestId: string;
  initialRows: ContestLeaderboardRow[];
  currentUserId: string | null;
  initialCurrentRound: number;
};

export function ContestLeaderboardLive({
  contestId,
  initialRows,
  currentUserId,
  initialCurrentRound,
}: Props) {
  const [rows, setRows] = useState<ContestLeaderboardRow[]>(initialRows);
  const [currentRound, setCurrentRound] = useState(initialCurrentRound);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setCurrentRound(initialCurrentRound);
  }, [initialCurrentRound]);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await pollContestLeaderboard(contestId);
        if (!alive.current || !res.contestExists) return;
        setRows(res.rows);
        setCurrentRound(res.currentRound);
      } catch {
        /* keep last good rows */
      }
    };

    const id = window.setInterval(() => void tick(), CONTEST_LEADERBOARD_POLL_MS);
    return () => window.clearInterval(id);
  }, [contestId]);

  const contest = { current_round: currentRound };
  const isRound1 = contest.current_round === 1;

  const viewerBestScore = useMemo(() => {
    if (currentUserId == null) return null;
    const mine = rows.filter((r) => r.user_id === currentUserId);
    if (mine.length === 0) return null;
    return Math.max(...mine.map((r) => r.score));
  }, [rows, currentUserId]);

  if (isRound1) {
    return (
      <div className="mt-2 space-y-3 py-6">
        <Round1LineupPerformance currentScore={viewerBestScore} />
        <p className="text-center text-xs text-slate-500">Rankings and scores unlock after Round 1</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="mt-8 text-sm text-slate-500">No entries yet</p>;
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-slate-500">
        Live scoring — refreshes about every {Math.round(CONTEST_LEADERBOARD_POLL_MS / 1000)}s. Rankings use lineup total
        score (same ordering as payouts).
      </p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-slate-500">
            <th className="w-14 pb-2 pr-2 text-center font-medium">Rank</th>
            <th className="w-24 pb-2 pr-2 text-center font-medium">Entry</th>
            <th className="pb-2 pr-4 text-left font-medium">Username</th>
            <th className="w-24 pb-2 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isSelf = currentUserId != null && r.user_id === currentUserId;
            return (
              <tr
                key={`${r.order}-${r.user_id}-${r.entryNumber}-${i}`}
                className={`border-b border-slate-800/80 ${isSelf ? "bg-slate-800" : ""}`}
              >
                <td className="py-2 pr-2 text-center tabular-nums text-slate-200">{r.order}</td>
                <td className="py-2 pr-2 text-center text-slate-200">Entry {r.entryNumber}</td>
                <td className="py-2 pr-4 text-slate-200">{r.username}</td>
                <td className="py-2 text-right tabular-nums text-slate-200">{r.score}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
