"use client";

import { useEffect, useState } from "react";
import {
  type ContestLifecycle,
  contestLifecycleBadgeClassName,
  contestLifecycleBadgeLabel,
  contestLockCountdownLabel,
} from "@/lib/contest-state";

export function ContestLifecycleBadge({ lifecycle }: { lifecycle: ContestLifecycle }) {
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${contestLifecycleBadgeClassName(lifecycle)}`}
    >
      {contestLifecycleBadgeLabel(lifecycle)}
    </span>
  );
}

/** Updates every second while mounted (filling / upcoming lock countdown). */
export function ContestLockCountdown({
  lifecycle,
  startsAtIso,
}: {
  lifecycle: ContestLifecycle;
  startsAtIso: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const label = contestLockCountdownLabel(lifecycle, startsAtIso, now);
  if (!label) {
    return null;
  }
  return <span className="text-[10px] font-semibold tabular-nums text-[#8b98a5]">{label}</span>;
}

export { ENTRY_PROTECTED_BADGE, ENTRY_PROTECTED_TOOLTIP } from "@/lib/entry-protection";
