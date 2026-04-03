"use client";

import { APP_CONFIG_DEFAULT_MAX_BETA_USERS } from "@/lib/config";
import { useEffect, useState } from "react";

type BetaStats = {
  approved: number;
  waiting: number;
  founders: number;
  maxBetaUsers: number;
  approvedUsers: Array<{ username: string; email: string }>;
};

export function ClosedBetaStats() {
  const [stats, setStats] = useState<BetaStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/closed-beta/stats", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setStats({
              approved: 0,
              waiting: 0,
              founders: 0,
              maxBetaUsers: APP_CONFIG_DEFAULT_MAX_BETA_USERS,
              approvedUsers: [],
            });
          }
          return;
        }
        const json = (await res.json()) as Partial<BetaStats>;
        if (!cancelled) {
          setStats({
            approved: Number(json.approved ?? 0),
            waiting: Number(json.waiting ?? 0),
            founders: Number(json.founders ?? 0),
            maxBetaUsers: Number(json.maxBetaUsers ?? APP_CONFIG_DEFAULT_MAX_BETA_USERS),
            approvedUsers: Array.isArray(json.approvedUsers)
              ? json.approvedUsers.map((u) => ({
                  username: typeof u?.username === "string" ? u.username : "",
                  email: typeof u?.email === "string" ? u.email : "",
                }))
              : [],
          });
        }
      } catch {
        if (!cancelled) {
          setStats({
            approved: 0,
            waiting: 0,
            founders: 0,
            maxBetaUsers: APP_CONFIG_DEFAULT_MAX_BETA_USERS,
            approvedUsers: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = stats == null;
  const approved = stats?.approved ?? 0;
  const waiting = stats?.waiting ?? 0;
  const founders = stats?.founders ?? 0;
  const maxBetaUsers = stats?.maxBetaUsers ?? APP_CONFIG_DEFAULT_MAX_BETA_USERS;
  const approvedUsers = stats?.approvedUsers ?? [];

  return (
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-center text-sm font-semibold text-white">Beta Access Stats</p>
      {loading ? <p className="mt-3 text-center text-sm text-slate-400">Loading beta stats...</p> : null}
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
              <li key={`${u.email}-${idx}`} className="flex items-center justify-between gap-3">
                <span className="truncate">{u.username ? `@${u.username}` : "—"}</span>
                <span className="shrink-0 text-slate-400">{u.email || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
