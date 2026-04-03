import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestLeaderboardBlock } from "@/components/contest-leaderboard-block";
import { getLeaderboardForContest } from "@/lib/contest-leaderboard-data";
import { getGolferLeaderboardForContest } from "@/lib/leaderboard";
import { isDevSimulateScoringAllowed } from "@/lib/dev-simulate-scoring";
import { fetchLobbyContestById } from "@/lib/contest-lobby-fetch";
import { formatLobbyEntryFeeUsd, isContestLineupLocked } from "@/lib/contest-lobby-shared";
import { fetchContestSafetyPoolStats } from "@/lib/safety-pool-stats";
import { getContestGolferOwnershipForViewer } from "@/lib/contest-golfer-ownership";
import { getDfsPremiumViewerForRequest } from "@/lib/dfs-premium-viewer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ContestPageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestPage(props: ContestPageProps) {
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";
  if (!id) {
    notFound();
  }

  const row = await fetchLobbyContestById(id);
  if (!row) {
    notFound();
  }

  const [{ rows }, { rows: golferRows }, dfsPremiumViewer, ownershipRows] = await Promise.all([
    getLeaderboardForContest(id),
    getGolferLeaderboardForContest(id),
    getDfsPremiumViewerForRequest(),
    getContestGolferOwnershipForViewer(id),
  ]);
  const safetyPool = await fetchContestSafetyPoolStats(id);
  const showDevSimulate = isDevSimulateScoringAllowed();

  const contestName = row.name;
  const entryFeeLabel = formatLobbyEntryFeeUsd(row.entry_fee_usd);
  const max = Math.max(1, row.max_entries);
  const current = Math.min(row.entry_count || 0, max);
  const entriesLabel = `${current.toLocaleString()} / ${max.toLocaleString()}`;
  const lineupLocked = isContestLineupLocked(row);
  const showLiveBadge = lineupLocked;

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Contest leaderboard</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{contestName}</h1>
          {showLiveBadge ? (
            <span className="rounded border border-red-500/50 bg-red-950/40 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-200">
              LIVE
            </span>
          ) : null}
        </div>
        {lineupLocked ? (
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
            Contest started — lineups locked
          </p>
        ) : null}
        <p className="mt-3 text-xs font-medium text-[#9fb0bf]">
          CashCaddies Safety Coverage protects one golfer per lineup.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-[#2a3039] bg-[#0f1419] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Entry fee</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{entryFeeLabel}</dd>
          </div>
          <div className="rounded-lg border border-[#2a3039] bg-[#0f1419] px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Entries</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{entriesLabel}</dd>
          </div>
          <div className="rounded-lg border border-[#2a3039] bg-[#0f1419] px-4 py-3 sm:col-span-2 lg:col-span-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Standings</dt>
            <dd className="mt-1 text-sm text-[#c5cdd5]">
              Entry ranks use <span className="text-[#8b98a5]">lineups.total_score</span> — sum of PGA-style fantasy points
              from <span className="text-[#8b98a5]">golfer_scores</span> (birdies, eagles, placement, bonuses). Golfer table
              shows per-player totals for this contest.
            </dd>
          </div>
        </dl>
        {safetyPool ? (
          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-[#0c1410] px-4 py-3 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">Safety Pool</p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium text-[#6b7684]">Current Pool</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#53d769]">
                  {formatLobbyEntryFeeUsd(safetyPool.poolUsd)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-[#6b7684]">Protected Entries</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-[#53d769]">
                  {safetyPool.totalEntries === 0
                    ? "—"
                    : `${safetyPool.protectedPercent % 1 === 0 ? safetyPool.protectedPercent.toFixed(0) : safetyPool.protectedPercent.toFixed(1)}%`}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-[10px] leading-snug text-[#6b7684]">
              {safetyPool.totalEntries > 0
                ? `${safetyPool.protectedCount} of ${safetyPool.totalEntries} entries with a protected golfer · Safety fees (this contest): ${formatLobbyEntryFeeUsd(safetyPool.totalProtectionFeesUsd)}`
                : "No entries yet — pool balance is platform-wide."}
            </p>
          </div>
        ) : null}
      </div>

      <div id="leaderboard">
        <ContestLeaderboardBlock
          key={id}
          contest={{ id }}
          initialRows={rows}
          initialGolferRows={golferRows}
          showSimulate={showDevSimulate}
          dfsPremiumViewer={dfsPremiumViewer}
          initialOwnershipRows={ownershipRows}
        />
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Link
            href="/lobby"
            className="inline-flex items-center justify-center rounded border border-[#2f3640] bg-[#1c2128] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[#c5cdd5] hover:bg-[#232a33]"
          >
            Lobby
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            {lineupLocked ? (
              <span
                title="Contest started — lineups locked"
                className="inline-flex min-w-[10rem] cursor-not-allowed items-center justify-center rounded border border-[#3d4550]/50 bg-[#1c2128]/80 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[#6b7684] opacity-60"
              >
                Enter contest
              </span>
            ) : (
              <Link
                href={`/lobby/${encodeURIComponent(id)}/enter`}
                className="inline-flex min-w-[10rem] items-center justify-center rounded border border-[#3d4550] bg-[#1c2128] px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[#e8ecf0] hover:bg-[#232a33]"
              >
                Enter contest
              </Link>
            )}
            {lineupLocked ? (
              <span
                title="Contest started — lineups locked"
                className="inline-flex min-w-[12rem] cursor-not-allowed items-center justify-center rounded border border-[#2d7a3a]/50 bg-[#1f8a3b]/60 px-8 py-3 text-base font-bold uppercase tracking-wide text-white/70 opacity-70"
              >
                Build lineup
              </span>
            ) : (
              <Link
                href={`/lineup?contest=${encodeURIComponent(id)}`}
                className="inline-flex min-w-[12rem] items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-8 py-3 text-base font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#249544] active:bg-[#1c7a34]"
              >
                Build lineup
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
