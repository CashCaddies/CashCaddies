"use client";

import { useState, useTransition } from "react";
import {
  generateMockGolfStatsForContest,
  generateTeeTimesForContest,
  recalculateWaveAssignmentForContest,
  refetchContestScoringLeaderboards,
  runPgaCutCalculationForContest,
} from "@/app/(protected)/contest/[contestId]/scoring-actions";
import { revalidateAfterSimulateScoring } from "@/app/(protected)/admin/scoring/revalidate-simulate-action";
import { simulateContestLineupScoresFromBrowser } from "@/lib/simulate-scoring-client";
import type { LeaderboardDisplayRow } from "@/lib/contest-leaderboard-data";
import type { GolferLeaderboardRow } from "@/lib/leaderboard";

type Props = {
  /** `contests.id` (UUID) from the route — same value as `contest.id` in the DB */
  contest: { id: string };
  /** Called with fresh Supabase leaderboard data after simulate + refetch. */
  onLeaderboardRefetched?: (data: { rows: LeaderboardDisplayRow[] }) => void;
  onGolferLeaderboardRefetched?: (data: { rows: GolferLeaderboardRow[] }) => void;
};

/** Dev/staging: run DFS score simulation for this contest (gated by env). */
export function LeaderboardSimulateScoring({
  contest,
  onLeaderboardRefetched,
  onGolferLeaderboardRefetched,
}: Props) {
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [mockPending, startMockTransition] = useTransition();
  const [cutPending, startCutTransition] = useTransition();
  const [teePending, startTeeTransition] = useTransition();
  const [wavePending, startWaveTransition] = useTransition();

  async function refreshBothLeaderboards() {
    const data = await refetchContestScoringLeaderboards(contest.id);
    onLeaderboardRefetched?.({ rows: data.entries });
    onGolferLeaderboardRefetched?.({ rows: data.golfers });
  }

  function onSubmitSimulate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await simulateContestLineupScoresFromBrowser({ id: contest.id });
      if (!result.ok) {
        setMessage({ type: "err", text: result.error });
        return;
      }

      await revalidateAfterSimulateScoring(contest.id);
      await refreshBothLeaderboards();

      setMessage({
        type: "ok",
        text: `Scoring updated for ${result.lineupsUpdated} lineup(s). Entry and golfer leaderboards refreshed.`,
      });
    });
  }

  function onSubmitMock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startMockTransition(async () => {
      const result = await generateMockGolfStatsForContest(contest.id);
      if (!result.ok) {
        setMessage({ type: "err", text: result.error });
        return;
      }

      await revalidateAfterSimulateScoring(contest.id);
      await refreshBothLeaderboards();

      setMessage({
        type: "ok",
        text: `Mock PGA stats applied; ${result.lineupsUpdated} lineup(s) refreshed. Random birdies, pars, bogeys, and finish positions.`,
      });
    });
  }

  function onSubmitCut(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startCutTransition(async () => {
      const result = await runPgaCutCalculationForContest(contest.id);
      if (!result.ok) {
        setMessage({ type: "err", text: result.error });
        return;
      }

      await revalidateAfterSimulateScoring(contest.id);
      await refreshBothLeaderboards();

      setMessage({
        type: "ok",
        text: `Cut applied: ${result.playersUpdated} golfer row(s) updated. MC players frozen; top 65 + ties stay active.`,
      });
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmitSimulate}
        className="rounded-lg border border-dashed border-[#3d4550] bg-[#0c1015] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Simulate scoring</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6b7684]">
              Client RPC: fills per-golfer contest stats and recomputes lineup totals. Requires{" "}
              <span className="text-[#8b98a5]">NEXT_PUBLIC_ALLOW_SIMULATE_SCORING</span> (or dev mode).
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || mockPending || cutPending || teePending || wavePending}
            className="shrink-0 rounded border border-amber-700/50 bg-amber-950/40 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-950/60 disabled:opacity-50 sm:min-w-[11rem]"
          >
            {pending ? "Scoring…" : "Simulate scoring"}
          </button>
        </div>
      </form>

      <form
        onSubmit={onSubmitMock}
        className="rounded-lg border border-dashed border-[#3d8bfd]/40 bg-[#0c1015] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Generate mock golf stats</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6b7684]">
              Server action: random birdies, pars, bogeys, finishing position, round fantasy points, and bonus fields —
              then recalculates PGA-style fantasy totals and entry lineups (same engine as simulate).
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || mockPending || cutPending || teePending || wavePending}
            className="shrink-0 rounded border border-[#3d8bfd]/50 bg-[#1a2740] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-sky-100 hover:bg-[#243552] disabled:opacity-50 sm:min-w-[14rem]"
          >
            {mockPending ? "Generating…" : "Generate mock golf stats"}
          </button>
        </div>
      </form>

      <form
        onSubmit={onSubmitCut}
        className="rounded-lg border border-dashed border-red-900/40 bg-[#140c0c] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Run cut calculation</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6b7684]">
              Simulates R2 stroke totals (if missing), applies PGA top 65 + ties, marks MC, freezes missed-cut fantasy
              totals and applies <span className="text-[#8b98a5]">contests.missed_cut_penalty_points</span> (default −5;
              set 0 to disable). Then refreshes entry lineups.
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || mockPending || cutPending || teePending || wavePending}
            className="shrink-0 rounded border border-red-700/50 bg-red-950/50 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-red-100 hover:bg-red-950/70 disabled:opacity-50 sm:min-w-[14rem]"
          >
            {cutPending ? "Running…" : "Run cut calculation"}
          </button>
        </div>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          startTeeTransition(async () => {
            const result = await generateTeeTimesForContest(contest.id);
            if (!result.ok) {
              setMessage({ type: "err", text: result.error });
              return;
            }
            await revalidateAfterSimulateScoring(contest.id);
            await refreshBothLeaderboards();
            setMessage({
              type: "ok",
              text: `Tee times set (${result.playersUpdated} row(s)): random 7:00 AM–2:00 PM Eastern, wave + vs-par for stats.`,
            });
          });
        }}
        className="rounded-lg border border-dashed border-sky-800/40 bg-[#0c1418] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Generate tee times</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6b7684]">
              Random tee times 7:00 AM–2:00 PM (Eastern), rounds 1–4, sample vs-par for wave averages, optional weather
              rating stub.
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || mockPending || cutPending || teePending || wavePending}
            className="shrink-0 rounded border border-sky-700/45 bg-sky-950/35 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-sky-100 hover:bg-sky-950/55 disabled:opacity-50 sm:min-w-[13rem]"
          >
            {teePending ? "Assigning…" : "Generate tee times"}
          </button>
        </div>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          startWaveTransition(async () => {
            const result = await recalculateWaveAssignmentForContest(contest.id);
            if (!result.ok) {
              setMessage({ type: "err", text: result.error });
              return;
            }
            await revalidateAfterSimulateScoring(contest.id);
            await refreshBothLeaderboards();
            setMessage({
              type: "ok",
              text: `Waves refreshed (${result.rowsTouched} row(s)). AM/PM stats update from tee_round_vs_par in the leaderboard.`,
            });
          });
        }}
        className="rounded-lg border border-dashed border-[#5c4a2a]/50 bg-[#12100c] p-4 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#c5cdd5]">Calculate wave advantage</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6b7684]">
              Re-derive AM/PM from stored tee times, then use the golfer table’s wave performance box (vs-par averages
              and advantage line).
            </p>
          </div>
          <button
            type="submit"
            disabled={pending || mockPending || cutPending || teePending || wavePending}
            className="shrink-0 rounded border border-[#6b5c3a]/60 bg-[#1a1610] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-amber-100/95 hover:bg-[#242018] disabled:opacity-50 sm:min-w-[15rem]"
          >
            {wavePending ? "Working…" : "Calculate wave advantage"}
          </button>
        </div>
      </form>

      {message ? (
        <p
          className={`text-sm ${message.type === "ok" ? "text-[#53d769]" : "text-amber-400"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
