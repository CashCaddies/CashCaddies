"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AdminLogRow = {
  id: string;
  action: string;
  admin_user_id: string;
  admin_display: string | null;
  target: string | null;
  /** Optional reason / context (`admin_logs.details`). */
  details?: string | null;
  created_at: string;
};

function formatAdmin(row: AdminLogRow): string {
  const d = row.admin_display?.trim();
  if (d) {
    return d;
  }
  return `${row.admin_user_id.slice(0, 8)}â€¦`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "â€”";
  }
  return d.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function RecentAdminActivity() {
  const [rows, setRows] = useState<AdminLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      setRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error: qErr } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (cancelled) {
        return;
      }
      if (qErr) {
        setError(qErr.message);
        setRows([]);
        return;
      }
      setError(null);
      setRows((data ?? []) as AdminLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="adminCard goldCardStatic mt-6 p-5">
      <h2 className="text-lg font-semibold text-white">Recent Admin Activity</h2>
      {error ? (
        <p className="mt-3 text-sm text-amber-200/90" role="alert">
          {error}
        </p>
      ) : rows === null ? (
        <p className="mt-4 text-sm text-slate-500">Loadingâ€¦</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No admin activity logged yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Recent admin activity</caption>
            <thead>
              <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Action</th>
                <th className="px-3 py-2.5">Admin</th>
                <th className="px-3 py-2.5">Time</th>
                <th className="px-3 py-2.5">Target</th>
                <th className="px-3 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/90 text-slate-200">
              {rows.map((r) => {
                const detailsTrim = (r.details ?? "").trim();
                return (
                  <tr key={r.id} className="hover:bg-slate-900/50">
                    <td className="px-3 py-2.5 font-medium text-white">{r.action}</td>
                    <td className="px-3 py-2.5 text-slate-300">{formatAdmin(r)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-400">{formatTime(r.created_at)}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5 text-slate-400" title={r.target ?? undefined}>
                      {r.target?.trim() ? r.target : "â€”"}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-2.5 text-slate-400"
                      title={detailsTrim || undefined}
                    >
                      {detailsTrim || "â€”"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
