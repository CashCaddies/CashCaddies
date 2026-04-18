"use client";

import { useEffect, useState } from "react";

const TARGET_MS = new Date(2026, 7, 1, 0, 0, 0).getTime();

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDays(days: number): string {
  return days >= 100 ? String(days) : pad2(days);
}

function computeParts(msLeft: number): { days: number; h: number; m: number; s: number } | null {
  if (msLeft <= 0) return null;
  const totalSec = Math.floor(msLeft / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    h: Math.floor((totalSec % 86400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
  };
}

export default function SoftLaunchCountdown() {
  const [mounted, setMounted] = useState(false);
  /** `null` after first tick means target passed (live). Before first tick, uninitialized. */
  const [remaining, setRemaining] = useState<ReturnType<typeof computeParts> | undefined>(undefined);

  useEffect(() => {
    setMounted(true);

    const update = () => {
      const now = Date.now();
      setRemaining(computeParts(TARGET_MS - now));
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted) {
    return null;
  }

  if (remaining === undefined) {
    return null;
  }

  return (
    <div className="flex w-full flex-col items-center justify-center border-y border-amber-400/30 bg-slate-950 py-4">
      <p className="mb-2 px-4 text-center text-sm font-semibold text-amber-400 md:text-base">
        Soft Launch Target – August 1
      </p>

      {remaining === null ? (
        <p className="text-center text-2xl font-bold text-green-400">Soft Launch Live</p>
      ) : (
        <>
          <div className="grid w-full max-w-md grid-cols-4 gap-2 px-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tabular-nums text-green-400 md:text-5xl">
                {formatDays(remaining.days)}
              </span>
              <span className="text-xs tracking-wide text-amber-400">DAYS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tabular-nums text-green-400 md:text-5xl">
                {pad2(remaining.h)}
              </span>
              <span className="text-xs tracking-wide text-amber-400">HRS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tabular-nums text-green-400 md:text-5xl">
                {pad2(remaining.m)}
              </span>
              <span className="text-xs tracking-wide text-amber-400">MIN</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold tabular-nums text-green-400 md:text-5xl">
                {pad2(remaining.s)}
              </span>
              <span className="text-xs tracking-wide text-amber-400">SEC</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
