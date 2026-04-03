"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminCompleteContest,
  adminLockContest,
  adminOpenContestForEntries,
  adminSetLateSwapEnabled,
  adminSettleContest,
  adminStartContest,
} from "@/app/admin/contest-lifecycle/actions";
import type { ContestLifecycle } from "@/lib/contest-state";

type Props = {
  contestId: string;
  lifecycle: ContestLifecycle;
  /** When false, late swap is disabled for this contest (default true). */
  lateSwapEnabled?: boolean;
};

export function AdminContestControls({ contestId, lifecycle, lateSwapEnabled = true }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setMsg(r.error ?? "Action failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded border border-[#3d4550] bg-[#1a1f26] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c5cdd5] hover:bg-[#232a33] disabled:opacity-50";

  return (
    <div className="mt-1 flex max-w-[14rem] flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {lifecycle === "upcoming" ? (
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={(e) => {
              e.stopPropagation();
              void run("open", () => adminOpenContestForEntries(contestId));
            }}
          >
            {busy === "open" ? "…" : "Open entries"}
          </button>
        ) : null}
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            void run("lock", () => adminLockContest(contestId));
          }}
        >
          {busy === "lock" ? "…" : "Lock"}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            void run("start", () => adminStartContest(contestId));
          }}
        >
          {busy === "start" ? "…" : "Start"}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            void run("complete", () => adminCompleteContest(contestId));
          }}
        >
          {busy === "complete" ? "…" : "Complete"}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          onClick={(e) => {
            e.stopPropagation();
            void run("settle", () => adminSettleContest(contestId));
          }}
        >
          {busy === "settle" ? "…" : "Settle"}
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy !== null}
          title={lateSwapEnabled ? "Turn off DFS late swap for this contest" : "Turn on late swap"}
          onClick={(e) => {
            e.stopPropagation();
            void run("lateSwap", () => adminSetLateSwapEnabled(contestId, !lateSwapEnabled));
          }}
        >
          {busy === "lateSwap" ? "…" : lateSwapEnabled ? "Late swap on" : "Late swap off"}
        </button>
      </div>
      {msg ? (
        <p className="max-w-[14rem] text-right text-[10px] text-amber-200" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
