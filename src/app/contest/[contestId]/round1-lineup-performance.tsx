"use client";

import { useEffect, useRef, useState } from "react";
import { getTrend, type LineupPerformanceTrend } from "@/lib/contest/lineup-performance-trend";

type Props = {
  /** Viewer’s best lineup total in this contest; null when not entered or unknown. */
  currentScore: number | null;
};

export function Round1LineupPerformance({ currentScore }: Props) {
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const currentScoreRef = useRef<number | null>(null);

  useEffect(() => {
    currentScoreRef.current = currentScore;
  }, [currentScore]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const v = currentScoreRef.current;
      if (typeof v === "number") {
        setPrevScore(v);
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const trend: LineupPerformanceTrend =
    currentScore != null ? getTrend(currentScore, prevScore) : "Neutral";

  const label = trend === "Up" ? "Trending Up" : trend === "Down" ? "Trending Down" : "Stable";

  return (
    <div className="text-sm text-gray-400">
      Lineup Performance:
      <span
        className={
          trend === "Up"
            ? "ml-2 text-green-400"
            : trend === "Down"
              ? "ml-2 text-red-400"
              : "ml-2 text-gray-400"
        }
      >
        {label}
      </span>
    </div>
  );
}
