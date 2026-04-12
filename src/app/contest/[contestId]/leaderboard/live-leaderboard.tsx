"use client";

import { useEffect, useState } from "react";
import type { GetLiveLeaderboardResult, LiveLeaderboardRow } from "@/lib/contest/get-live-leaderboard";

const POLL_MS = 10_000;

export default function LiveLeaderboard({ contestId }: { contestId: string }) {
  const [data, setData] = useState<LiveLeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/contest/${encodeURIComponent(contestId)}/leaderboard`, {
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
          setData(json.rows);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Request failed.");
      }
    };

    void fetchData();
    const interval = window.setInterval(() => void fetchData(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [contestId]);

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
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
        {data.map((row) => (
          <tr key={row.entryId} className="border-b border-slate-800/80 text-center">
            <td className="py-2 tabular-nums text-slate-200">{row.rank}</td>
            <td className="py-2 text-left text-slate-200">{row.username.trim() || "anon"}</td>
            <td className="py-2 text-right tabular-nums text-slate-200">{Number(row.totalScore).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
