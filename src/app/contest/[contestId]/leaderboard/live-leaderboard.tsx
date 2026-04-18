"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Round1LineupPerformance } from "@/app/contest/[contestId]/round1-lineup-performance";
import type { GetLiveLeaderboardResult, LiveLeaderboardRow } from "@/lib/contest/get-live-leaderboard";
import { supabase } from "@/lib/supabase/client";

export default function LiveLeaderboard({ contestId }: { contestId: string }) {
  const [data, setData] = useState<LiveLeaderboardRow[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setViewerUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: NodeJS.Timeout | null = null;
    const id = contestId.trim();
    if (!id) {
      setError("Missing contest id.");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/contest/${encodeURIComponent(id)}/leaderboard`, {
          credentials: "same-origin",
        });
        const raw: unknown = await res.json();

        if (!res.ok) {
          const msg =
            raw &&
            typeof raw === "object" &&
            "ok" in raw &&
            (raw as { ok: unknown }).ok === false &&
            "error" in raw
              ? String((raw as { error: unknown }).error)
              : res.statusText;
          if (!cancelled) setError(msg);
          return;
        }

        const json = raw as GetLiveLeaderboardResult;
        if (!json.ok) {
          if (!cancelled) setError(json.error);
          return;
        }

        if (!cancelled) {
          setError(null);
          if (json.ok) {
            setCurrentRound(json.currentRound);
            setData(json.rows);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed.");
      }
    };

    const handleRealtime = () => {
      if (cancelled) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!cancelled) void fetchData();
      }, 500);
    };

    void fetchData();

    const channelTopic = `live-leaderboard:${id}`;
    const stale = supabase.getChannels().find((c) => c.topic === channelTopic);
    if (stale) {
      void supabase.removeChannel(stale);
    }

    /** Requires `lineups` + `golfer_scores` in Publication (Supabase Dashboard → Realtime). */
    const channel = supabase
      .channel(channelTopic)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lineups",
          filter: `contest_id=eq.${id}`,
        },
        handleRealtime,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lineups",
          filter: `contest_id=eq.${id}`,
        },
        handleRealtime,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "golfer_scores",
          filter: `contest_id=eq.${id}`,
        },
        handleRealtime,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      void supabase.removeChannel(channel);
    };
  }, [contestId]);

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  const contest = { current_round: currentRound };
  const isRound1 = contest.current_round === 1;

  const viewerBestScore = useMemo(() => {
    if (viewerUserId == null) return null;
    const mine = data.filter((r) => r.userId === viewerUserId);
    if (mine.length === 0) return null;
    return Math.max(...mine.map((r) => r.totalScore));
  }, [data, viewerUserId]);

  if (isRound1) {
    return (
      <div className="mt-2 space-y-3 py-6">
        <Round1LineupPerformance currentScore={viewerBestScore} />
        <p className="text-center text-xs text-slate-500">Rankings and scores unlock after Round 1</p>
      </div>
    );
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-800 text-slate-500">
          <th className="pb-2 text-center font-medium">Rank</th>
          <th className="pb-2 text-left font-medium">User</th>
          <th className="pb-2 text-right font-medium">Score</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const expanded = openEntryId === row.entryId;
          return (
            <Fragment key={row.entryId}>
              <tr
                className="border-b border-slate-800/80 text-center transition-colors hover:bg-slate-800/40 cursor-pointer"
                onClick={() => setOpenEntryId(expanded ? null : row.entryId)}
                aria-expanded={expanded}
              >
                <td className="py-2 tabular-nums text-slate-200">{row.rank}</td>
                <td className="py-2 text-left text-slate-200">{row.username.trim() || "anon"}</td>
                <td className="py-2 text-right tabular-nums text-slate-200">
                  {Number(row.totalScore).toFixed(2)}
                </td>
              </tr>
              {expanded && (
                <tr className="bg-slate-900/50">
                  <td colSpan={3} className="px-3 py-2 text-left text-xs text-slate-300">
                    <div className="mb-1 font-medium text-slate-400">Lineup</div>
                    {row.players.length > 0 ? (
                      row.players.map((p) => (
                        <div
                          key={`${row.entryId}-${p.golferId || p.playerName}`}
                          className="flex justify-between gap-4 border-b border-slate-800/50 py-1.5 last:border-0"
                        >
                          <span>{p.playerName}</span>
                          <span className="tabular-nums text-slate-200">{Number(p.score).toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500">No roster data (lineup may be restricted or still loading).</p>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
