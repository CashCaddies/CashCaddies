"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getContestLabEntryStatus,
  getLineupIntelligence,
  listSimulationHistory,
  runContestLabSimulation,
  type ContestLabRunResult,
  type LineupIntelligenceResult,
  type SimulationHistoryRow,
} from "@/app/contest-lab/actions";
import { isContestLabEnabledClient } from "@/lib/contest-lab/flags";
import type { SimulationScenario } from "@/lib/contest-lab/simulation-engine";

type Props = {
  contestId: string;
  entryId: string;
  lineupId: string;
  players: Array<{ id: string; name: string }>;
};

function buildNameMap(players: Props["players"]): Record<string, string> {
  return Object.fromEntries(players.map((p) => [p.id, p.name]));
}

function deltaColor(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-slate-400";
}

function LineupIntelligenceBlock({ intel }: { intel: LineupIntelligenceResult | null }) {
  if (!intel) {
    return null;
  }
  if (!intel.unlocked) {
    return (
      <p className="text-xs text-slate-500">
        Run simulations to unlock lineup intelligence.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-violet-800/50 bg-violet-950/25 px-3 py-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">Lineup Intelligence (Beta)</p>
      <ul className="mt-2 space-y-1 text-slate-200">
        <li>
          <span className="text-slate-500">Risk Level:</span> {intel.riskLevel}
        </li>
        <li>
          <span className="text-slate-500">Volatility:</span>{" "}
          {intel.volatilityScore != null ? `${intel.volatilityScore} / 10` : "—"}
        </li>
        <li>
          <span className="text-slate-500">WD Exposure:</span> {intel.wdExposure}
        </li>
        <li>
          <span className="text-slate-500">Cut Risk:</span> {intel.cutRisk}
        </li>
      </ul>
    </div>
  );
}

export function ContestLabPanel({ contestId, entryId, lineupId, players }: Props) {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [manualScenario, setManualScenario] = useState<"WD" | "BAD_ROUND" | "HOT_ROUND" | "MISS_CUT">("BAD_ROUND");
  const [golferId, setGolferId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContestLabRunResult | null>(null);
  const [history, setHistory] = useState<SimulationHistoryRow[]>([]);
  const [intel, setIntel] = useState<LineupIntelligenceResult | null>(null);

  const loadData = useCallback(async () => {
    const [s, h, i] = await Promise.all([
      getContestLabEntryStatus(entryId),
      listSimulationHistory(entryId),
      getLineupIntelligence(entryId),
    ]);
    setRemaining(s.remaining);
    if (h.ok) {
      setHistory(h.rows);
    }
    setIntel(i);
  }, [entryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  if (!isContestLabEnabledClient()) {
    return null;
  }

  async function run(scenario: SimulationScenario, gid?: string | null) {
    setLoading(true);
    setError(null);
    setResult(null);
    const r = await runContestLabSimulation({
      contestId,
      entryId,
      lineupId,
      scenario,
      golferId: gid ?? null,
      golferNamesById: buildNameMap(players),
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setResult(r.result);
    setRemaining(r.result.remainingRuns);
    await loadData();
  }

  function onRunManual() {
    const gid =
      manualScenario === "WD"
        ? golferId
        : golferId.trim() !== ""
          ? golferId
          : null;
    void run(manualScenario as SimulationScenario, gid);
  }

  const disabledRun =
    loading ||
    (remaining !== null && remaining <= 0) ||
    (manualScenario === "WD" && !golferId);

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <LineupIntelligenceBlock intel={intel} />

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 rounded-lg border border-sky-600/50 bg-sky-950/40 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/50"
      >
        Test Lineup (Beta)
      </button>
      {remaining !== null ? (
        <p className="mt-1.5 text-xs text-slate-500">
          {remaining > 0
            ? `${remaining} simulation${remaining === 1 ? "" : "s"} left for this entry.`
            : "Simulation limit reached."}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Simulations are hypothetical and do not affect contest results.
      </p>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contest-lab-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 id="contest-lab-title" className="text-lg font-bold text-white">
                Contest Lab Beta
              </h3>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm text-slate-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual test</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
                    Select golfer
                    <div className="relative z-0">
                      <select
                        value={golferId}
                        onChange={(e) => setGolferId(e.target.value)}
                        className="w-full relative z-0 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                      >
                        <option value="">—</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-slate-400">
                    Select scenario
                    <div className="relative z-0">
                      <select
                        value={manualScenario}
                        onChange={(e) => setManualScenario(e.target.value as typeof manualScenario)}
                        className="w-full relative z-0 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-slate-100"
                      >
                        <option value="WD">Simulate golfer WD</option>
                        <option value="BAD_ROUND">Bad round (+5–10 DFS pts penalty)</option>
                        <option value="HOT_ROUND">Hot round (+3–8 DFS pts bonus)</option>
                        <option value="MISS_CUT">Missed cut (~50% weekend pts)</option>
                      </select>
                    </div>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={disabledRun}
                  onClick={() => void onRunManual()}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-40"
                >
                  Run simulation
                </button>
              </div>

              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chaos test</p>
                <div className="mt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={loading || (remaining !== null && remaining <= 0)}
                    onClick={() => void run("RANDOM_WD")}
                    className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
                  >
                    Random WD
                  </button>
                  <button
                    type="button"
                    disabled={loading || (remaining !== null && remaining <= 0)}
                    onClick={() => void run("BAD_ROUND", null)}
                    className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
                  >
                    Random bad round
                  </button>
                  <button
                    type="button"
                    disabled={loading || (remaining !== null && remaining <= 0)}
                    onClick={() => void run("CHAOS", null)}
                    className="rounded-lg border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-950/50 disabled:opacity-40"
                  >
                    Random chaos
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
              ) : null}

              {result ? (
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm">
                  <p className="font-semibold text-white">Simulation result</p>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>
                      <span className="text-slate-500">Scenario applied:</span> {result.scenarioApplied}
                    </li>
                    <li>
                      <span className="text-slate-500">Golfer affected:</span>{" "}
                      {result.golferAffectedName ?? result.golferAffectedId ?? "—"}
                    </li>
                    <li>
                      <span className="text-slate-500">Projected finish:</span> #{result.simulatedPosition}
                    </li>
                    <li>
                      <span className="text-slate-500">Previous finish:</span> #{result.previousPosition}
                    </li>
                    <li>
                      <span className="text-slate-500">Position change:</span>{" "}
                      <span className={`font-semibold ${deltaColor(result.positionChange)}`}>
                        {result.positionChange > 0
                          ? `+${result.positionChange}`
                          : result.positionChange < 0
                            ? `${result.positionChange}`
                            : "0"}
                      </span>
                    </li>
                    <li>
                      <span className="text-slate-500">Score change:</span>{" "}
                      <span className={`font-semibold ${deltaColor(result.scoreChange)}`}>
                        {result.scoreChange > 0 ? `+${result.scoreChange.toFixed(1)}` : result.scoreChange.toFixed(1)}
                      </span>
                    </li>
                  </ul>
                </div>
              ) : null}

              {history.length > 0 ? (
                <div className="border-t border-slate-800 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Simulation history</p>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                    {history.map((h) => (
                      <li key={h.id} className="rounded border border-slate-800/80 bg-slate-950/40 px-2 py-1.5">
                        <span className="text-slate-500">
                          {new Date(h.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>{" "}
                        · {h.scenario}
                        {h.golfer_name ? ` · ${h.golfer_name}` : ""} · pos{" "}
                        <span className={deltaColor(h.position_change)}>
                          {h.position_change > 0 ? `+${h.position_change}` : h.position_change}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
