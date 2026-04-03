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
    <div className="flex min-h-[110px] w-full flex-col items-center justify-center border-y border-amber-400/30 bg-slate-950 py-6">
      <p className="mb-4 text-center font-semibold text-amber-400">Soft Launch Target – August 1</p>

      {remaining === null ? (
        <p className="text-center text-2xl font-bold text-green-400">Soft Launch Live</p>
      ) : (
        <>
          <div className="flex items-center justify-center gap-6 text-5xl font-bold text-green-400">
            <span className="tabular-nums">{formatDays(remaining.days)}</span>
            <span className="text-green-400/80" aria-hidden>
              :
            </span>
            <span className="tabular-nums">{pad2(remaining.h)}</span>
            <span className="text-green-400/80" aria-hidden>
              :
            </span>
            <span className="tabular-nums">{pad2(remaining.m)}</span>
            <span className="text-green-400/80" aria-hidden>
              :
            </span>
            <span className="tabular-nums">{pad2(remaining.s)}</span>
          </div>
          <div className="mt-3 flex justify-center gap-16 text-xs tracking-widest text-amber-400">
            <span>DAYS</span>
            <span>HRS</span>
            <span>MIN</span>
            <span>SEC</span>
          </div>
        </>
      )}
    </div>
  );
}
