import type { SupabaseClient } from "@supabase/supabase-js";
import { lateSwapWindowOpenForContest } from "@/lib/late-swap";
import { supabase } from "@/lib/supabase/client";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

function entryFeeDisplay(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0";
  const rounded = Math.round(usd * 100) / 100;
  return `$${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

const DEFAULT_LINEUP_SALARY_CAP = 50_000;

export type ResolvedContestForLineup = {
  id: string;
  name: string;
  entryFeeLabel: string;
  entryFeeUsd: number;
  /** ISO timestamp for contest start (lock). */
  startTimeIso: string | null;
  /** When true, roster edits and new entries are closed (matches DB `now() >= starts_at`). */
  lineupLocked: boolean;
  /** Contest allows late swap when in live phase. */
  lateSwapEnabled: boolean;
  /** Past starts_at + 5m and not terminal status — matches `contest_late_swap_live`. */
  lateSwapWindowOpen: boolean;
  /** Editing an entered lineup is allowed (pre-start or late-swap window). */
  allowEntryLineupEdit: boolean;
  /** Synthetic pool from `sim_players` (mirrored into `golfers` for FK). */
  usesSimPool: boolean;
  /** Salary budget for DFS lineups (defaults to 50,000 when unset). */
  salaryCap: number;
};

/** Server: contest row for lineup page from `contests`. */
export async function loadContestForLineupPage(contestIdRaw: string | undefined): Promise<ResolvedContestForLineup> {
  const contestId = contestIdRaw?.trim() || "default";

  if (contestId === "default") {
    return {
      id: contestId,
      name: "Practice / draft",
      entryFeeLabel: "—",
      entryFeeUsd: 0,
      startTimeIso: null,
      lineupLocked: false,
      lateSwapEnabled: true,
      lateSwapWindowOpen: false,
      allowEntryLineupEdit: true,
      usesSimPool: false,
      salaryCap: DEFAULT_LINEUP_SALARY_CAP,
    };
  }

  try {
        let { data, error: contestLoadErr } = await supabase
      .from("contests")
      .select("id, name, entry_fee_usd, starts_at, late_swap_enabled, status, uses_sim_pool, salary_cap")
      .eq("id", contestId)
      .maybeSingle();

    if (contestLoadErr && isMissingColumnOrSchemaError(contestLoadErr)) {
      const retry = await supabase
        .from("contests")
        .select("id, name, entry_fee_usd, starts_at, late_swap_enabled, status")
        .eq("id", contestId)
        .maybeSingle();
      data = retry.data as typeof data;
      contestLoadErr = retry.error;
    }

    if (data) {
      const entryFeeUsd = Number(data.entry_fee_usd);
      const fee = Number.isFinite(entryFeeUsd) ? entryFeeUsd : 0;
      const startIso = data.starts_at != null ? String(data.starts_at) : null;
      const t = startIso ? Date.parse(startIso) : NaN;
      const lineupLocked = Number.isFinite(t) && Date.now() >= t;
      const lateSwapEnabled = (data as { late_swap_enabled?: boolean }).late_swap_enabled !== false;
      const status = (data as { status?: string | null }).status ?? null;
      const lateSwapWindowOpen = lateSwapWindowOpenForContest({
        startsAtIso: startIso,
        lateSwapEnabled,
        status,
      });
      const allowEntryLineupEdit = !lineupLocked || lateSwapWindowOpen;
      const usesSimPool = Boolean((data as { uses_sim_pool?: boolean | undefined }).uses_sim_pool);
      const rawCap = Number((data as { salary_cap?: number | null | undefined }).salary_cap);
      const salaryCap =
        Number.isFinite(rawCap) && rawCap > 0 ? Math.floor(rawCap) : DEFAULT_LINEUP_SALARY_CAP;
      return {
        id: data.id,
        name: data.name,
        entryFeeUsd: fee,
        entryFeeLabel: entryFeeDisplay(fee),
        startTimeIso: startIso,
        lineupLocked,
        lateSwapEnabled,
        lateSwapWindowOpen,
        allowEntryLineupEdit,
        usesSimPool,
        salaryCap,
      };
    }
  } catch {
    // fall through
  }

  return {
    id: contestId,
    name: `Contest (${contestId})`,
    entryFeeLabel: "—",
    entryFeeUsd: 0,
    startTimeIso: null,
    lineupLocked: false,
    lateSwapEnabled: true,
    lateSwapWindowOpen: false,
    allowEntryLineupEdit: true,
    usesSimPool: false,
    salaryCap: DEFAULT_LINEUP_SALARY_CAP,
  };
}

/** Server action: match contest fees from DB for payment flows. */
export async function resolveContestEntryForSubmit(
  supabase: SupabaseClient,
  contestId: string,
): Promise<{ contestName: string; entryFeeUsd: number }> {
  const id = contestId?.trim() || "default";
  if (id === "default") {
    return { contestName: "Practice / draft", entryFeeUsd: 0 };
  }

  const { data } = await supabase.from("contests").select("name, entry_fee_usd").eq("id", id).maybeSingle();
  if (data) {
    const entryFeeUsd = Number(data.entry_fee_usd);
    return {
      contestName: data.name,
      entryFeeUsd: Number.isFinite(entryFeeUsd) ? entryFeeUsd : 0,
    };
  }

  return { contestName: `Contest (${id})`, entryFeeUsd: 0 };
}
