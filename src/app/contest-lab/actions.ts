"use server";

import { revalidatePath } from "next/cache";
import { isContestLabEnabledServer } from "@/lib/contest-lab/flags";
import { computeLineupIntelligence, type SimulationResultRow } from "@/lib/contest-lab/lineup-risk";
import { loadContestEntryScores, loadGolferStatesForLineup } from "@/lib/contest-lab/load-lineup-states";
import {
  applySimulationScenario,
  computePosition,
  pickWeightedChaosScenario,
  pickRandomGolferId,
  type ResolvedSimulationScenario,
  type SimulationScenario,
} from "@/lib/contest-lab/simulation-engine";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";

const MAX_SIMS_PER_ENTRY = 3;

export type ContestLabRunResult = {
  simulationId: string;
  scenarioApplied: string;
  scenarioCode: ResolvedSimulationScenario;
  golferAffectedId: string | null;
  golferAffectedName: string | null;
  simulatedScore: number;
  previousScore: number;
  scoreChange: number;
  simulatedPosition: number;
  previousPosition: number;
  positionChange: number;
  remainingRuns: number;
};

export type SimulationHistoryRow = {
  id: string;
  created_at: string;
  scenario: string;
  affected_golfer_id: string | null;
  golfer_name: string | null;
  previous_score: number | null;
  simulated_score: number;
  score_change: number | null;
  previous_position: number;
  simulated_position: number;
  position_change: number;
};

export type LineupIntelligenceResult = {
  simulationCount: number;
  unlocked: boolean;
  riskLevel: "Safe" | "Balanced" | "Aggressive" | null;
  volatilityScore: number | null;
  wdExposure: "Low" | "Medium" | "High" | null;
  cutRisk: "Low" | "Medium" | "High" | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveScenarioForRun(
  scenario: SimulationScenario,
  golferId: string | null,
  states: import("@/lib/contest-lab/simulation-engine").GolferSimState[],
  chaosOrigin: boolean,
): { resolved: ResolvedSimulationScenario; targetGolferId: string | null } {
  let s: SimulationScenario = scenario;
  let gid = golferId?.trim() || null;

  if (s === "CHAOS") {
    s = pickWeightedChaosScenario() as SimulationScenario;
  }

  if (s === "RANDOM_WD") {
    return { resolved: "RANDOM_WD", targetGolferId: null };
  }

  if (s === "WD") {
    if (!gid) {
      if (!chaosOrigin) {
        throw new Error("Select a golfer for WD.");
      }
      gid = pickRandomGolferId(states);
    }
    return { resolved: "WD", targetGolferId: gid };
  }

  if (s === "BAD_ROUND" || s === "HOT_ROUND" || s === "MISS_CUT") {
    if (!gid) {
      gid = pickRandomGolferId(states);
    }
    return { resolved: s, targetGolferId: gid };
  }

  throw new Error("Invalid scenario.");
}

export async function getContestLabEntryStatus(entryId: string | null): Promise<{
  enabled: boolean;
  remaining: number | null;
}> {
  if (!entryId || !isContestLabEnabledServer()) {
    return { enabled: false, remaining: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { enabled: false, remaining: null };
  }

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdminUser = isAdmin(prof?.role);

  const { count, error } = await supabase
    .from("simulations")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId)
    .eq("user_id", user.id);

  if (error) {
    return { enabled: false, remaining: null };
  }

  const used = Number(count ?? 0);
  const cap = isAdminUser ? 999_999 : MAX_SIMS_PER_ENTRY;
  return { enabled: true, remaining: Math.max(0, cap - used) };
}

export async function listSimulationHistory(entryId: string): Promise<
  { ok: true; rows: SimulationHistoryRow[] } | { ok: false; error: string }
> {
  if (!isContestLabEnabledServer()) {
    return { ok: true, rows: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }

  const { data, error } = await supabase
    .from("simulation_results")
    .select(
      `
      previous_score,
      simulated_score,
      score_change,
      previous_position,
      simulated_position,
      position_change,
      simulations!inner (
        id,
        created_at,
        scenario,
        affected_golfer_id,
        entry_id,
        user_id
      )
    `,
    )
    .eq("simulations.entry_id", entryId)
    .eq("simulations.user_id", user.id)
    .order("created_at", { ascending: false, foreignTable: "simulations" });

  if (error) {
    return { ok: false, error: error.message };
  }

  const raw = data ?? [];
  const golferIds = [
    ...new Set(
      raw
        .map((row) => {
          const sim = row.simulations as { affected_golfer_id?: string | null } | null;
          return sim?.affected_golfer_id;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameById = new Map<string, string>();
  if (golferIds.length > 0) {
    const { data: gRows } = await supabase.from("golfers").select("id,name").in("id", golferIds);
    for (const g of gRows ?? []) {
      nameById.set(String(g.id), String(g.name ?? ""));
    }
  }

  const rows: SimulationHistoryRow[] = raw.map((row) => {
    const simRaw = row.simulations as
      | {
          id: string;
          created_at: string;
          scenario: string;
          affected_golfer_id: string | null;
        }
      | {
          id: string;
          created_at: string;
          scenario: string;
          affected_golfer_id: string | null;
        }[]
      | null;
    const sim = Array.isArray(simRaw) ? simRaw[0] : simRaw;
    if (!sim) {
      return null;
    }
    const r = row;
    const gid = sim.affected_golfer_id != null ? String(sim.affected_golfer_id) : null;
    const gname = gid ? (nameById.get(gid) ?? null) : null;
    return {
      id: String(sim.id),
      created_at: String(sim.created_at),
      scenario: String(sim.scenario ?? ""),
      affected_golfer_id: gid,
      golfer_name: gname && gname.length > 0 ? gname : null,
      previous_score: r.previous_score != null ? Number(r.previous_score) : null,
      simulated_score: Number(r.simulated_score ?? 0),
      score_change: r.score_change != null ? Number(r.score_change) : null,
      previous_position: Number(r.previous_position ?? 0),
      simulated_position: Number(r.simulated_position ?? 0),
      position_change: Number(r.position_change ?? 0),
    };
  }).filter((row): row is SimulationHistoryRow => row !== null);

  rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return { ok: true, rows };
}

export async function getLineupIntelligence(entryId: string | null): Promise<LineupIntelligenceResult | null> {
  if (!entryId || !isContestLabEnabledServer()) {
    return null;
  }

  const hist = await listSimulationHistory(entryId);
  if (!hist.ok) {
    return null;
  }

  const inputs: SimulationResultRow[] = hist.rows.map((r) => ({
    scenario: r.scenario,
    position_change: r.position_change,
    previous_position: r.previous_position,
    simulated_position: r.simulated_position,
    score_change: r.score_change,
  }));

  return computeLineupIntelligence(inputs);
}

export async function runContestLabSimulation(payload: {
  contestId: string;
  entryId: string;
  lineupId: string;
  scenario: SimulationScenario;
  golferId?: string | null;
  golferNamesById?: Record<string, string>;
}): Promise<{ ok: true; result: ContestLabRunResult } | { ok: false; error: string }> {
  if (!isContestLabEnabledServer()) {
    return { ok: false, error: "Contest Lab is not enabled." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in required." };
  }

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdminUser = isAdmin(prof?.role);
  const cap = isAdminUser ? 999_999 : MAX_SIMS_PER_ENTRY;

  const { count: usedCount, error: countErr } = await supabase
    .from("simulations")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", payload.entryId)
    .eq("user_id", user.id);

  if (countErr) {
    return { ok: false, error: countErr.message };
  }
  if (Number(usedCount ?? 0) >= cap) {
    return { ok: false, error: `Simulation limit reached (${cap} per entry).` };
  }

  const { data: ce, error: ceErr } = await supabase
    .from("contest_entries")
    .select("id, user_id, lineup_id, contest_id")
    .eq("id", payload.entryId)
    .maybeSingle();

  if (ceErr || !ce) {
    return { ok: false, error: "Entry not found." };
  }
  if (ce.user_id !== user.id) {
    return { ok: false, error: "Not your entry." };
  }
  if (ce.contest_id !== payload.contestId || ce.lineup_id !== payload.lineupId) {
    return { ok: false, error: "Entry does not match contest or lineup." };
  }

  const statesResult = await loadGolferStatesForLineup(supabase, payload.contestId, payload.lineupId);
  if (!statesResult.ok) {
    return { ok: false, error: statesResult.error };
  }

  let resolved: ResolvedSimulationScenario;
  let targetGolferId: string | null;
  try {
    const r = resolveScenarioForRun(
      payload.scenario,
      payload.golferId ?? null,
      statesResult.states,
      payload.scenario === "CHAOS",
    );
    resolved = r.resolved;
    targetGolferId = r.targetGolferId;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid simulation." };
  }

  let engineOut: ReturnType<typeof applySimulationScenario>;
  try {
    engineOut = applySimulationScenario(statesResult.states, resolved, targetGolferId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Simulation failed." };
  }

  const scoresResult = await loadContestEntryScores(supabase, payload.contestId);
  if (!scoresResult.ok) {
    return { ok: false, error: scoresResult.error };
  }

  const previousPosition = computePosition(scoresResult.scores, payload.entryId);
  const simulatedPosition = computePosition(scoresResult.scores, payload.entryId, engineOut.simulatedTotal);
  const positionChange = previousPosition - simulatedPosition;
  const previousScore =
    scoresResult.scores.find((s) => s.entryId === payload.entryId)?.score ?? engineOut.previousTotal;
  const scoreChange = round2(engineOut.simulatedTotal - previousScore);

  const { data: insertedSim, error: insErr } = await supabase
    .from("simulations")
    .insert({
      user_id: user.id,
      contest_id: payload.contestId,
      entry_id: payload.entryId,
      simulation_type: "ENTRY",
      scenario: resolved,
      affected_golfer_id: engineOut.affectedGolferId,
    })
    .select("id")
    .single();

  if (insErr || !insertedSim) {
    return { ok: false, error: insErr?.message ?? "Could not save simulation." };
  }

  const simId = insertedSim.id as string;

  const { error: resErr } = await supabase.from("simulation_results").insert({
    simulation_id: simId,
    entry_id: payload.entryId,
    previous_score: previousScore,
    simulated_score: engineOut.simulatedTotal,
    score_change: scoreChange,
    simulated_position: simulatedPosition,
    previous_position: previousPosition,
    position_change: positionChange,
  });

  if (resErr) {
    return { ok: false, error: resErr.message };
  }

  const names = payload.golferNamesById ?? {};
  const affId = engineOut.affectedGolferId;
  const affName = affId ? (names[affId] ?? null) : null;

  const nextRemaining = Math.max(0, cap - Number(usedCount ?? 0) - 1);

  revalidatePath("/dashboard/lineups");

  return {
    ok: true,
    result: {
      simulationId: simId,
      scenarioApplied: engineOut.scenarioLabel,
      scenarioCode: resolved,
      golferAffectedId: affId,
      golferAffectedName: affName,
      simulatedScore: engineOut.simulatedTotal,
      previousScore,
      scoreChange,
      simulatedPosition,
      previousPosition,
      positionChange,
      remainingRuns: nextRemaining,
    },
  };
}
