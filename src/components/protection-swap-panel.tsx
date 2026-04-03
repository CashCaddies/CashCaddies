"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GolferRow } from "@/lib/golfers";
import { supabase } from "@/lib/supabase";
import { swapProtectedGolferAction } from "@/app/protection/actions";

const SALARY_CAP = 50_000;

type Props = {
  lineupId: string;
  contestId: string;
  oldGolferId: string;
  oldGolferName: string;
  currentTotalSalary: number;
  oldGolferSalary: number;
  onSwapped: () => void;
};

export function ProtectionSwapPanel({
  lineupId,
  contestId,
  oldGolferId,
  oldGolferName,
  currentTotalSalary,
  oldGolferSalary,
  onSwapped,
}: Props) {
  const [golfers, setGolfers] = useState<GolferRow[]>([]);
  const [scores, setScores] = useState<
    { golfer_id: string; has_teed_off: boolean | null; playing_status: string | null }[]
  >([]);
  const [rosterIds, setRosterIds] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setMsg(null);
    const [{ data: gs }, { data: lp }, { data: gdata }] = await Promise.all([
      supabase
        .from("golfer_scores")
        .select("golfer_id, has_teed_off, playing_status")
        .eq("contest_id", contestId),
      supabase.from("lineup_players").select("golfer_id").eq("lineup_id", lineupId),
      supabase.from("golfers").select("id,name,salary,pga_id,image_url").order("salary", { ascending: false }),
    ]);
    setScores((gs ?? []) as typeof scores);
    setRosterIds(
      new Set(
        (lp ?? []).map((r: { golfer_id: string }) => String(r.golfer_id)),
      ),
    );
    setGolfers((gdata ?? []) as GolferRow[]);
    setLoading(false);
  }, [contestId, lineupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligible = useMemo(() => {
    const byG = new Map(scores.map((s) => [s.golfer_id, s]));
    return golfers.filter((g) => {
      if (g.id === oldGolferId || rosterIds.has(g.id)) return false;
      const s = byG.get(g.id);
      if (!s) return true;
      if (s.has_teed_off) return false;
      const ps = s.playing_status ?? "active";
      return ps === "active" || ps === "not_started";
    });
  }, [golfers, scores, rosterIds, oldGolferId]);

  const selected = useMemo(() => golfers.find((g) => g.id === choice), [golfers, choice]);

  const newTotal =
    selected != null ? currentTotalSalary - oldGolferSalary + selected.salary : currentTotalSalary;
  const overCap = newTotal > SALARY_CAP;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice || overCap) return;
    setBusy(true);
    setMsg(null);
    const r = await swapProtectedGolferAction({
      lineupId,
      contestId,
      oldGolferId,
      newGolferId: choice,
    });
    setBusy(false);
    if (r.ok) {
      onSwapped();
      setChoice("");
      return;
    }
    setMsg(r.error);
  }

  if (loading) {
    return <p className="text-xs text-slate-500">Loading swap options…</p>;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-3 text-sm text-amber-50"
    >
      <p className="font-semibold text-amber-100">
        Swap available — replace {oldGolferName}
      </p>
      <p className="mt-1 text-xs text-amber-200/90">
        Pick a golfer who has not teed off. Swap available until replacement tee time.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-amber-100/90">
          <span className="sr-only">Replacement golfer</span>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="mt-1 w-full rounded border border-amber-800/60 bg-slate-950 px-2 py-2 text-sm text-white"
          >
            <option value="">Select golfer…</option>
            {eligible.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · ${g.salary.toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={!choice || overCap || busy}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
        >
          {busy ? "Swapping…" : "Swap"}
        </button>
      </div>
      {selected ? (
        <p className={`mt-2 text-xs ${overCap ? "font-semibold text-red-300" : "text-amber-200/80"}`}>
          New lineup salary: ${newTotal.toLocaleString()}
          {overCap ? ` — exceeds $${SALARY_CAP.toLocaleString()} cap` : ""}
        </p>
      ) : null}
      {msg ? <p className="mt-2 text-xs text-red-300">{msg}</p> : null}
    </form>
  );
}
