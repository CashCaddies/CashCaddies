"use client";

import { APP_CONFIG_DEFAULT_MAX_BETA_USERS } from "@/lib/config";
import { useEffect, useState } from "react";

type BetaStats = {
  approved: number;
  waiting: number;
  founders: number;
  maxBetaUsers: number;
  /** Usernames only; API may still return email — not stored or shown. */
  approvedUsers: Array<{ username: string }>;
};

const emptyStats: BetaStats = {
  approved: 0,
  waiting: 0,
  founders: 0,
  maxBetaUsers: APP_CONFIG_DEFAULT_MAX_BETA_USERS,
  approvedUsers: [],
};

function normalizeStats(json: Partial<BetaStats>): BetaStats {
  return {
    approved: Number(json.approved ?? 0),
    waiting: Number(json.waiting ?? 0),
    founders: Number(json.founders ?? 0),
    maxBetaUsers: Number(json.maxBetaUsers ?? APP_CONFIG_DEFAULT_MAX_BETA_USERS),
    approvedUsers: Array.isArray(json.approvedUsers)
      ? json.approvedUsers.map((u) => ({
          username: typeof u?.username === "string" ? u.username : "",
        }))
      : [],
  };
}

export function ClosedBetaStats() {
  const [data, setData] = useState<BetaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/closed-beta/stats", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("stats unavailable");
        return res.json() as Promise<Partial<BetaStats>>;
      })
      .then((json) => {
        if (!cancelled) setData(normalizeStats(json));
      })
      .catch(() => {
        if (!cancelled) setData(emptyStats);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || data == null) {
    return (
      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <p className="text-center text-sm font-semibold text-white">Beta Access Stats</p>
        <div className="mt-3 flex justify-center">
          <div className="text-gray-500 text-sm">Loading stats...</div>
        </div>
      </div>
    );
  }

  const { approved, waiting, founders, maxBetaUsers, approvedUsers } = data;

  return (
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-center text-sm font-semibold text-white">Beta Access Stats</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Approved / cap</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">
            {approved} / {maxBetaUsers}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Founding testers</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{founders}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-center sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Players waiting</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-300">{waiting} pending review</p>
        </div>
      </div>
      {waiting > 0 ? (
        <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
          Limited spots available
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Approved Users</p>
        {approvedUsers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No approved users yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {approvedUsers.map((u, idx) => (
              <li key={`${u.username || "user"}-${idx}`} className="truncate">
                {u.username ? `@${u.username}` : "—"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
