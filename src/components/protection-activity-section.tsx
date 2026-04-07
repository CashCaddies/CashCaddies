"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";

type Row = {
  id: string;
  event_type: string;
  protection_amount: number | string | null;
  created_at: string;
  contest_id: string;
  contestName: string;
};

export function ProtectionActivitySection() {
  const { user, isReady } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !user) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("protection_events")
      .select("id, event_type, protection_amount, created_at, contest_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      const base = (data ?? []) as Omit<Row, "contestName">[];
      const ids = [...new Set(base.map((r) => r.contest_id).filter(Boolean))];
      let names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: cn } = await supabase.from("contests").select("id,name").in("id", ids);
        names = new Map(
          (cn ?? []).map((c: { id: string; name: string }) => [String(c.id), String(c.name)]),
        );
      }
      setRows(
        base.map((r) => ({
          ...r,
          contestName: names.get(r.contest_id) ?? "Contest",
        })),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!isReady) return;
    void load();
  }, [isReady, load]);

  useEffect(() => {
    if (!user || !supabase) return;
    const ch = supabase
      .channel("protection-events")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "protection_events",
          filter: `user_id=eq.${user.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, load]);

  if (!isReady || !user) {
    return null;
  }

  return (
    <section className="goldCard p-5">
      <h2 className="text-lg font-bold text-white">Safety Coverage Activity</h2>
      <p className="mt-1 text-sm text-slate-400">
        Safety Coverage fund credits issued when a protected golfer WD/DNS/DQ is resolved without a swap.
      </p>
      {loading && <p className="mt-4 text-sm text-slate-500">Loadingâ€¦</p>}
      {err && (
        <p className="mt-4 rounded border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {err}
        </p>
      )}
      {!loading && !err && rows.length === 0 && (
        <p className="mt-4 text-sm text-slate-500">No protection payouts yet.</p>
      )}
      {!loading && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-800">
          {rows.map((r) => (
            <li key={r.id} className="py-3 first:pt-0">
              <p className="font-medium text-slate-100">
                Protected lineup â€“ {String(r.event_type).toUpperCase()}
              </p>
              <p className="mt-0.5 text-sm text-emerald-300">
                ${Number(r.protection_amount ?? 0).toFixed(2)} safety coverage credit issued
              </p>
              <p className="mt-1 text-xs text-slate-400">{r.contestName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatWhen(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
