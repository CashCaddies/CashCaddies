"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refundContestEntryCharge, type DebitSnapshot } from "@/lib/contest-entry-payment";
import { computeProtectionFeeUsd, tierFromPoints } from "@/lib/loyalty";
import { CASHCADDIE_PROTECTION_FEE_USD } from "@/lib/contest-lobby-data";
import { resolveContestEntryForSubmit } from "@/lib/contest-resolve";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { LineupPlayerInsert } from "@/lib/lineup-players";
import { parseContestUuid } from "@/lib/contest-id";
import { lineupContestIdForDb } from "@/lib/lineup-contest-id";
import { lineupHasContestEntry } from "@/lib/lineup-permissions";
import {
  assertContestLineupUnlockedForDraft,
  contestLockErrorMessage,
  getContestLineupLockState,
} from "@/lib/contest-lock-server";
import {
  assertClosedBetaApprovedForContestActions,
  assertContestEntryCapacityOk,
  assertContestEntryEligible,
  normalizeContestEntryErrorMessage,
} from "@/lib/contest-entry-eligibility";
import { lateSwapWindowOpenForContest } from "@/lib/late-swap";

const SALARY_CAP = 50_000;
const ROSTER_MAX = 6;

type GolferDbRow = { id: string; name: string; salary: number; game_start_time?: string | null };

function lineupPlayerInsertsFromSubmitted(
  lineupId: string,
  submitted: LineupGolferInput[],
  dbRows: GolferDbRow[],
): LineupPlayerInsert[] {
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  return submitted.map((g, slotIndex) => ({
    lineup_id: lineupId,
    golfer_id: g.id,
    is_protected: false,
    slot_index: slotIndex,
    game_start_time: byId.get(g.id)?.game_start_time ?? null,
  }));
}

export type LineupGolferInput = {
  id: string;
  name: string;
  salary: number;
};

export type SubmitLineupResult =
  | { ok: true; lineupId: string; safetyContributionUsd?: number }
  | { ok: false; error: string };

async function rollbackContestEntry(opts: {
  admin: ReturnType<typeof createServiceRoleClient>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  snapshot: DebitSnapshot;
  reason: string;
}) {
  if (opts.admin) {
    const r = await refundContestEntryCharge(opts.admin, {
      userId: opts.userId,
      snapshot: opts.snapshot,
      reason: opts.reason,
    });
    if (!r.ok) {
      /* refund best-effort */
    }
    return;
  }
  const { error } = await opts.supabase.from("contest_entries").delete().eq("id", opts.snapshot.contestEntryId);
  if (error) {
    /* delete best-effort */
  }
}

export async function submitLineup(payload: {
  golfers: LineupGolferInput[];
  contestId: string;
}): Promise<SubmitLineupResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Supabase is not configured on the server." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to submit a lineup." };
  }

  const contestId = lineupContestIdForDb(payload.contestId);
  if (!contestId) {
    return { ok: false, error: "Choose a contest from the lobby before submitting." };
  }

  const { locked: contestLocked } = await getContestLineupLockState(supabase, contestId);
  if (contestLocked) {
    return { ok: false, error: contestLockErrorMessage() };
  }

  const submitted = payload.golfers;
  if (!Array.isArray(submitted) || submitted.length !== ROSTER_MAX) {
    return { ok: false, error: "Lineup must include exactly 6 golfers." };
  }

  const ids = submitted.map((g) => g.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ROSTER_MAX) {
    return { ok: false, error: "Invalid or duplicate golfer in lineup." };
  }

  const { data: dbRows, error: fetchErr } = await supabase
    .from("golfers")
    .select("id,name,salary,game_start_time")
    .in("id", ids);

  if (fetchErr || !dbRows || dbRows.length !== ROSTER_MAX) {
    return { ok: false, error: "Could not verify golfers against the database." };
  }

  const byId = new Map(dbRows.map((r) => [r.id, r as GolferDbRow]));
  let totalSalary = 0;

  for (const sub of submitted) {
    const row = byId.get(sub.id);
    if (!row) {
      return { ok: false, error: "Invalid golfer id in lineup." };
    }
    if (row.name !== sub.name || row.salary !== sub.salary) {
      return { ok: false, error: "Golfer data does not match the database." };
    }
    totalSalary += row.salary;
  }

  if (totalSalary > SALARY_CAP) {
    return { ok: false, error: "Lineup cannot exceed the $50,000 salary cap." };
  }

  /** Automatic lineup protection: flat safety coverage fee (one “slot”) at entry. */
  const protectionEnabled = true;
  const { data: walletRow } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", user.id)
    .maybeSingle();

  const tier = tierFromPoints(Number(walletRow?.loyalty_points ?? 0));
  const protectionFeeUsd = computeProtectionFeeUsd(CASHCADDIE_PROTECTION_FEE_USD, 1, tier);

  const { contestName, entryFeeUsd } = await resolveContestEntryForSubmit(supabase, contestId);
  const totalPaidUsd = entryFeeUsd + protectionFeeUsd;

  const eligSubmit = await assertContestEntryEligible(supabase, {
    contestId,
    userId: user.id,
    entryFeeUsd,
    protectionFeeUsd,
  });
  if (!eligSubmit.ok) {
    return { ok: false, error: eligSubmit.error };
  }

  const admin = createServiceRoleClient();

  const { data: atomicData, error: atomicErr } = await supabase.rpc("create_contest_entry_atomic", {
    p_user_id: user.id,
    p_contest_id: contestId,
    p_entry_fee: entryFeeUsd,
    p_protection_fee: protectionFeeUsd,
    p_total_paid: totalPaidUsd,
    p_protection_enabled: protectionEnabled,
    p_lineup_id: null,
    p_contest_name: contestName,
  });

  if (atomicErr) {
    return { ok: false, error: atomicErr.message };
  }

  const atomicRow = atomicData as {
    ok?: boolean;
    error?: string;
    contest_entry_id?: string;
    balance_restored?: number;
    protection_credit_restored?: number;
    loyalty_points_earned?: number;
  } | null;

  if (!atomicRow || atomicRow.ok === false) {
    const msg =
      typeof atomicRow?.error === "string" && atomicRow.error.trim() !== ""
        ? atomicRow.error
        : "Could not create contest entry.";
    return { ok: false, error: msg };
  }

  const ceId = atomicRow.contest_entry_id != null ? String(atomicRow.contest_entry_id) : "";
  if (!ceId) {
    return { ok: false, error: "Could not create contest entry." };
  }

  const paymentSnapshot: DebitSnapshot = {
    creditsRestored: 0,
    balanceRestored: Number(atomicRow.balance_restored ?? 0),
    protectionCreditRestored: Number(atomicRow.protection_credit_restored ?? 0),
    loyaltyPointsEarned: Number(atomicRow.loyalty_points_earned ?? 0),
    contestEntryId: ceId,
  };

  const totalSalaryInt = Math.round(totalSalary);
  const recordedTotalPaid = totalPaidUsd;

  const { data: lineupRow, error: lineupErr } = await supabase
    .from("lineups")
    .insert({
      user_id: user.id,
      contest_id: contestId,
      total_salary: totalSalaryInt,
      entry_fee: entryFeeUsd,
      protection_fee: protectionFeeUsd,
      total_paid: recordedTotalPaid,
      protection_enabled: protectionEnabled,
      contest_entry_id: paymentSnapshot.contestEntryId,
    })
    .select("id")
    .single();

  if (lineupErr || !lineupRow) {
    await rollbackContestEntry({
      admin,
      supabase,
      userId: user.id,
      snapshot: paymentSnapshot,
      reason: `Refund — lineup save failed (${contestId})`,
    });
    return { ok: false, error: lineupErr?.message ?? "Failed to save lineup." };
  }

  const playerRows = lineupPlayerInsertsFromSubmitted(
    lineupRow.id,
    submitted,
    [...byId.values()],
  );

  const { error: playersErr } = await supabase.from("lineup_players").insert(playerRows);

  if (playersErr) {
    await supabase.from("lineups").delete().eq("id", lineupRow.id);
    await rollbackContestEntry({
      admin,
      supabase,
      userId: user.id,
      snapshot: paymentSnapshot,
      reason: `Refund — lineup players save failed (${contestId})`,
    });
    return { ok: false, error: playersErr.message };
  }

  const linker = admin ?? supabase;
  const { error: linkErr } = await linker
    .from("contest_entries")
    .update({ lineup_id: lineupRow.id })
    .eq("id", paymentSnapshot.contestEntryId);
  if (linkErr) {
    await supabase.from("lineups").delete().eq("id", lineupRow.id);
    await rollbackContestEntry({
      admin,
      supabase,
      userId: user.id,
      snapshot: paymentSnapshot,
      reason: `Refund — could not link contest entry to lineup (${contestId})`,
    });
    return { ok: false, error: "Could not link contest entry to lineup. You were not charged." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/lobby");
  revalidatePath(`/contest/${contestId}`);
  return {
    ok: true,
    lineupId: lineupRow.id,
    safetyContributionUsd: Math.round(protectionFeeUsd * 100) / 100,
  };
}

export type EnterWithSavedLineupResult =
  | { ok: true; contestEntryId: string; safetyContributionUsd: number }
  | { ok: false; error: string };

/** Save a 6-golfer roster without paying; use “Enter contest” to create contest_entries and pay. */
export async function saveLineupDraft(payload: {
  golfers: LineupGolferInput[];
  contestId?: string | null;
  /** @deprecated Ignored — automatic protection applies at contest entry. */
  protectionEnabled?: boolean;
  protectedGolferIds?: string[];
  /** When set, replace this draft’s roster (must be yours, not yet entered). */
  lineupId?: string | null;
}): Promise<SubmitLineupResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Supabase is not configured on the server." };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to save a lineup." };
  }

  const betaDraft = await assertClosedBetaApprovedForContestActions(supabase);
  if (!betaDraft.ok) {
    return { ok: false, error: betaDraft.error };
  }

  const resolvedContestId = lineupContestIdForDb(payload.contestId);

  const draftLockErr = await assertContestLineupUnlockedForDraft(supabase, {
    resolvedContestId,
    existingLineupId: payload.lineupId,
  });
  if (draftLockErr) {
    return { ok: false, error: draftLockErr };
  }

  if (resolvedContestId) {
    const capDraft = await assertContestEntryCapacityOk(supabase, {
      contestId: resolvedContestId,
      userId: user.id,
    });
    if (!capDraft.ok) {
      return { ok: false, error: capDraft.error };
    }
  }

  const submitted = payload.golfers;
  if (!Array.isArray(submitted) || submitted.length !== ROSTER_MAX) {
    return { ok: false, error: "Lineup must include exactly 6 golfers." };
  }

  const ids = submitted.map((g) => g.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ROSTER_MAX) {
    return { ok: false, error: "Invalid or duplicate golfer in lineup." };
  }

  const { data: dbRows, error: fetchErr } = await supabase
    .from("golfers")
    .select("id,name,salary,game_start_time")
    .in("id", ids);

  if (fetchErr || !dbRows || dbRows.length !== ROSTER_MAX) {
    return { ok: false, error: "Could not verify golfers against the database." };
  }

  const byId = new Map(dbRows.map((r) => [r.id, r as GolferDbRow]));
  let totalSalary = 0;

  for (const sub of submitted) {
    const row = byId.get(sub.id);
    if (!row) {
      return { ok: false, error: "Invalid golfer id in lineup." };
    }
    if (row.name !== sub.name || row.salary !== sub.salary) {
      return { ok: false, error: "Golfer data does not match the database." };
    }
    totalSalary += row.salary;
  }

  if (totalSalary > SALARY_CAP) {
    return { ok: false, error: "Lineup cannot exceed the $50,000 salary cap." };
  }

  const totalSalaryInt = Math.round(totalSalary);
  const existingLineupId = payload.lineupId?.trim() || null;

  /** Edit draft: same `lineups.id` — delete prior `lineup_players` rows, then insert new rows for that `lineup_id`. */
  if (existingLineupId) {
    const { data: existing, error: exErr } = await supabase
      .from("lineups")
      .select("id, user_id, contest_entry_id")
      .eq("id", existingLineupId)
      .maybeSingle();

    if (exErr || !existing) {
      return { ok: false, error: "Lineup not found." };
    }
    if (existing.user_id !== user.id) {
      return { ok: false, error: "Not your lineup." };
    }
    if (lineupHasContestEntry(existing)) {
      return {
        ok: false,
        error: "This lineup is already entered in a contest and cannot be edited.",
      };
    }

    const { error: delErr } = await supabase.from("lineup_players").delete().eq("lineup_id", existingLineupId);
    if (delErr) {
      return { ok: false, error: delErr.message };
    }

    const { error: upErr } = await supabase
      .from("lineups")
      .update({
        contest_id: resolvedContestId,
        total_salary: totalSalaryInt,
        entry_fee: 0,
        protection_fee: 0,
        total_paid: 0,
        protection_enabled: false,
      })
      .eq("id", existingLineupId)
      .eq("user_id", user.id)
      .is("contest_entry_id", null);

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    const playerRows = lineupPlayerInsertsFromSubmitted(
      existingLineupId,
      submitted,
      [...byId.values()],
    );

    const { error: playersErr } = await supabase.from("lineup_players").insert(playerRows);

    if (playersErr) {
      return { ok: false, error: playersErr.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/lineups");
    revalidatePath("/lobby");
    if (resolvedContestId) {
      revalidatePath(`/lobby/${resolvedContestId}/enter`);
    }
    return { ok: true, lineupId: existingLineupId };
  }

  const { data: lineupRow, error: lineupErr } = await supabase
    .from("lineups")
    .insert({
      user_id: user.id,
      contest_id: resolvedContestId,
      total_salary: totalSalaryInt,
      entry_fee: 0,
      protection_fee: 0,
      total_paid: 0,
      protection_enabled: false,
      contest_entry_id: null,
    })
    .select("id")
    .single();

  if (lineupErr || !lineupRow) {
    return { ok: false, error: lineupErr?.message ?? "Failed to save lineup." };
  }

  const playerRowsNew = lineupPlayerInsertsFromSubmitted(lineupRow.id, submitted, [...byId.values()]);

  const { error: playersErr } = await supabase.from("lineup_players").insert(playerRowsNew);

  if (playersErr) {
    await supabase.from("lineups").delete().eq("id", lineupRow.id);
    return { ok: false, error: playersErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath("/lobby");
  if (resolvedContestId) {
    revalidatePath(`/lobby/${resolvedContestId}/enter`);
  }
  return { ok: true, lineupId: lineupRow.id };
}

/** Editing an already-entered contest lineup (before contest starts).
 * Updates roster + protected golfers by rewriting `lineup_players` only (no new lineup, no new contest entry).
 */
export async function editContestEntryLineup(payload: {
  entryId: string;
  lineupId: string;
  contestId: string;
  golfers: LineupGolferInput[];
}): Promise<SubmitLineupResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to edit this lineup." };
  }

  const entryId = payload.entryId?.trim();
  const lineupId = payload.lineupId?.trim();
  const contestId = payload.contestId?.trim();
  if (!entryId || !lineupId || !contestId) {
    return { ok: false, error: "Invalid contest entry edit request." };
  }

  const betaDraft = await assertClosedBetaApprovedForContestActions(supabase);
  if (!betaDraft.ok) {
    return { ok: false, error: betaDraft.error };
  }

  const { locked: contestLocked, startsAtIso } = await getContestLineupLockState(supabase, contestId);

  const { data: contestMeta } = await supabase
    .from("contests")
    .select("starts_at, late_swap_enabled, contest_status")
    .eq("id", contestId)
    .maybeSingle();

  const lateSwapOpen = lateSwapWindowOpenForContest({
    startsAtIso: contestMeta?.starts_at ?? startsAtIso,
    lateSwapEnabled: contestMeta?.late_swap_enabled,
    contestStatus: contestMeta?.contest_status,
  });

  if (contestLocked && !lateSwapOpen) {
    return { ok: false, error: contestLockErrorMessage() };
  }

  const { data: entryRow, error: entryErr } = await supabase
    .from("contest_entries")
    .select("id,user_id,contest_id,lineup_id")
    .eq("id", entryId)
    .maybeSingle();

  if (entryErr || !entryRow) {
    return { ok: false, error: "Contest entry not found." };
  }
  if (String(entryRow.user_id) !== user.id) {
    return { ok: false, error: "Not your contest entry." };
  }
  if (String(entryRow.lineup_id) !== lineupId) {
    return { ok: false, error: "Contest entry does not match this lineup." };
  }
  if (String(entryRow.contest_id) !== contestId) {
    return { ok: false, error: "Contest entry is for a different contest." };
  }

  const { data: lineupRow, error: lineupFetchErr } = await supabase
    .from("lineups")
    .select("id,user_id,contest_id")
    .eq("id", lineupId)
    .maybeSingle();

  if (lineupFetchErr || !lineupRow) {
    return { ok: false, error: "Lineup not found." };
  }
  if (String(lineupRow.user_id) !== user.id) {
    return { ok: false, error: "Not your lineup." };
  }
  if (String(lineupRow.contest_id) !== contestId) {
    return { ok: false, error: "This lineup is for a different contest." };
  }

  const submitted = payload.golfers;
  if (!Array.isArray(submitted) || submitted.length !== ROSTER_MAX) {
    return { ok: false, error: "Lineup must include exactly 6 golfers." };
  }

  const ids = submitted.map((g) => g.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ROSTER_MAX) {
    return { ok: false, error: "Invalid or duplicate golfer in lineup." };
  }

  const { data: dbRows, error: fetchErr } = await supabase
    .from("golfers")
    .select("id,name,salary,game_start_time")
    .in("id", ids);

  if (fetchErr || !dbRows || dbRows.length !== ROSTER_MAX) {
    return { ok: false, error: "Could not verify golfers against the database." };
  }

  const byId = new Map(dbRows.map((r) => [r.id, r as GolferDbRow]));
  let totalSalary = 0;

  for (const sub of submitted) {
    const row = byId.get(sub.id);
    if (!row) {
      return { ok: false, error: "Invalid golfer id in lineup." };
    }
    if (row.name !== sub.name || row.salary !== sub.salary) {
      return { ok: false, error: "Golfer data does not match the database." };
    }
    totalSalary += row.salary;
  }

  if (totalSalary > SALARY_CAP) {
    return { ok: false, error: "Lineup cannot exceed the $50,000 salary cap." };
  }

  const totalSalaryInt = Math.round(totalSalary);
  const startsForProtection = contestMeta?.starts_at ?? startsAtIso;
  const startsAtMs = Date.parse(String(startsForProtection ?? ""));
  const pastContestStart = Number.isFinite(startsAtMs) && Date.now() >= startsAtMs;

  const { error: lineupUpErr } = await supabase
    .from("lineups")
    .update({
      total_salary: totalSalaryInt,
      protection_enabled: true,
    })
    .eq("id", lineupId)
    .eq("user_id", user.id);

  if (lineupUpErr) {
    return { ok: false, error: lineupUpErr.message };
  }

  if (contestLocked && lateSwapOpen) {
    const { error: syncErr } = await supabase.rpc("sync_lineup_player_game_locks", {
      p_lineup_id: lineupId,
    });
    if (syncErr) {
      return { ok: false, error: syncErr.message };
    }

    const { data: slotRows, error: slotsErr } = await supabase
      .from("lineup_players")
      .select("id, slot_index, golfer_id, game_start_time, is_locked")
      .eq("lineup_id", lineupId)
      .order("slot_index", { ascending: true });

    if (slotsErr || !slotRows || slotRows.length !== ROSTER_MAX) {
      return { ok: false, error: slotsErr?.message ?? "Could not load lineup slots." };
    }

    const bySlot = new Map(slotRows.map((r) => [Number(r.slot_index), r]));

    for (let i = 0; i < ROSTER_MAX; i++) {
      const slot = bySlot.get(i);
      if (!slot) {
        return { ok: false, error: "Lineup slot data is inconsistent." };
      }
      if (slot.is_locked && String(slot.golfer_id) !== submitted[i].id) {
        return { ok: false, error: "That player is locked and cannot be swapped." };
      }
    }

    for (let i = 0; i < ROSTER_MAX; i++) {
      const slot = bySlot.get(i)!;
      if (slot.is_locked) {
        continue;
      }
      if (String(slot.golfer_id) === submitted[i].id) {
        continue;
      }
      const g = byId.get(submitted[i].id);
      const { error: upLpErr } = await supabase
        .from("lineup_players")
        .update({
          golfer_id: submitted[i].id,
          game_start_time: g?.game_start_time ?? null,
        })
        .eq("id", slot.id)
        .eq("lineup_id", lineupId);
      if (upLpErr) {
        return { ok: false, error: upLpErr.message };
      }
    }
  } else {
    const { error: delErr } = await supabase.from("lineup_players").delete().eq("lineup_id", lineupId);
    if (delErr) {
      return { ok: false, error: delErr.message };
    }

    const playerRows = lineupPlayerInsertsFromSubmitted(lineupId, submitted, [...byId.values()]);
    const { error: playersErr } = await supabase.from("lineup_players").insert(playerRows);
    if (playersErr) {
      return { ok: false, error: playersErr.message };
    }
  }

  await supabase
    .from("contest_entries")
    .update({
      lineup_edited: true,
      ...(pastContestStart ? { entry_protected: false } : {}),
    })
    .eq("id", entryId)
    .eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath(`/lobby/${contestId}/enter`);
  revalidatePath(`/contest/${contestId}`);
  revalidatePath(`/contests/${contestId}`);
  return { ok: true, lineupId };
}

/** Pay entry fee and create contest_entries row tied to an existing draft lineup. */
export async function enterContestWithSavedLineup(payload: {
  contestId: string;
  lineupId: string;
}): Promise<EnterWithSavedLineupResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { ok: false, error: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be logged in to enter a contest." };
  }

  const lineupId = payload.lineupId?.trim() || "";
  const contestId = parseContestUuid(payload.contestId);
  if (!contestId || !lineupId) {
    return { ok: false, error: "Invalid contest or lineup." };
  }

  const { locked: enterLocked } = await getContestLineupLockState(supabase, contestId);
  if (enterLocked) {
    return { ok: false, error: contestLockErrorMessage() };
  }

  const { data: lineup, error: lineupErr } = await supabase
    .from("lineups")
    .select("id, user_id, contest_id, contest_entry_id, lineup_players ( golfer_id )")
    .eq("id", lineupId)
    .maybeSingle();

  if (lineupErr || !lineup) {
    return { ok: false, error: "Lineup not found." };
  }

  if (lineup.user_id !== user.id) {
    return { ok: false, error: "Not your lineup." };
  }

  const lineupContestIdNorm = parseContestUuid(
    lineup.contest_id != null ? String(lineup.contest_id) : null,
  );
  if (lineupContestIdNorm != null && lineupContestIdNorm !== contestId) {
    return { ok: false, error: "This lineup is for a different contest." };
  }

  if (lineup.contest_entry_id) {
    return { ok: false, error: "This lineup is already entered." };
  }

  const lps = (lineup.lineup_players ?? []) as { golfer_id: string }[];
  if (lps.length !== ROSTER_MAX) {
    return { ok: false, error: "Draft lineup must have exactly 6 golfers." };
  }

  const rosterIds = new Set(lps.map((p) => p.golfer_id));
  const protectionEnabled = true;

  for (const gid of rosterIds) {
    const { error: upLpErr } = await supabase
      .from("lineup_players")
      .update({ is_protected: false })
      .eq("lineup_id", lineupId)
      .eq("golfer_id", gid);
    if (upLpErr) {
      return { ok: false, error: upLpErr.message };
    }
  }

  const { error: lineupProtErr } = await supabase
    .from("lineups")
    .update({ protection_enabled: true })
    .eq("id", lineupId)
    .eq("user_id", user.id)
    .is("contest_entry_id", null);

  if (lineupProtErr) {
    return { ok: false, error: lineupProtErr.message };
  }

  const { data: walletRow } = await supabase
    .from("profiles")
    .select("loyalty_points")
    .eq("id", user.id)
    .maybeSingle();

  const tier = tierFromPoints(Number(walletRow?.loyalty_points ?? 0));

  const { contestName, entryFeeUsd } = await resolveContestEntryForSubmit(supabase, contestId);
  const protectionFeeUsd = computeProtectionFeeUsd(CASHCADDIE_PROTECTION_FEE_USD, 1, tier);
  const totalPaidUsd = entryFeeUsd + protectionFeeUsd;

  const eligEnter = await assertContestEntryEligible(supabase, {
    contestId,
    userId: user.id,
    entryFeeUsd,
    protectionFeeUsd,
    lineupId,
  });
  if (!eligEnter.ok) {
    return { ok: false, error: eligEnter.error };
  }

  const admin = createServiceRoleClient();

  const { data: atomicData, error: atomicErr } = await supabase.rpc("create_contest_entry_atomic", {
    p_user_id: user.id,
    p_contest_id: contestId,
    p_entry_fee: entryFeeUsd,
    p_protection_fee: protectionFeeUsd,
    p_total_paid: totalPaidUsd,
    p_protection_enabled: protectionEnabled,
    p_lineup_id: lineupId,
    p_contest_name: contestName,
  });

  if (atomicErr) {
    return { ok: false, error: normalizeContestEntryErrorMessage(atomicErr.message) };
  }

  const atomicRow = atomicData as {
    ok?: boolean;
    error?: string;
    contest_entry_id?: string;
    balance_restored?: number;
    protection_credit_restored?: number;
    loyalty_points_earned?: number;
  } | null;

  if (!atomicRow || atomicRow.ok === false) {
    const msg =
      typeof atomicRow?.error === "string" && atomicRow.error.trim() !== ""
        ? atomicRow.error
        : "Could not create contest entry.";
    return { ok: false, error: normalizeContestEntryErrorMessage(msg) };
  }

  const entryIdRaw = atomicRow.contest_entry_id != null ? String(atomicRow.contest_entry_id) : "";
  if (!entryIdRaw) {
    return { ok: false, error: "Could not create contest entry." };
  }

  const { error: upErr } = await supabase
    .from("lineups")
    .update({
      contest_id: contestId,
      contest_entry_id: entryIdRaw,
      entry_fee: entryFeeUsd,
      protection_fee: protectionFeeUsd,
      total_paid: totalPaidUsd,
      protection_enabled: protectionEnabled,
    })
    .eq("id", lineupId)
    .eq("user_id", user.id);

  if (upErr) {
    if (admin) {
      await refundContestEntryCharge(admin, {
        userId: user.id,
        snapshot: {
          creditsRestored: 0,
          balanceRestored: Number(atomicRow.balance_restored ?? totalPaidUsd),
          protectionCreditRestored: Number(atomicRow.protection_credit_restored ?? 0),
          loyaltyPointsEarned: Number(atomicRow.loyalty_points_earned ?? 0),
          contestEntryId: entryIdRaw,
        },
        reason: `Refund — could not finalize lineup entry (${contestId})`,
      });
    } else {
      await supabase.from("contest_entries").delete().eq("id", entryIdRaw);
    }
    return { ok: false, error: upErr.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/lineups");
  revalidatePath("/lobby");
  revalidatePath(`/lobby/${contestId}/enter`);
  revalidatePath(`/contest/${contestId}`);
  return {
    ok: true,
    contestEntryId: entryIdRaw,
    safetyContributionUsd: Math.round(protectionFeeUsd * 100) / 100,
  };
}
