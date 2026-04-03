import { createServiceRoleClient } from "@/lib/supabase/admin";

/** Matches SQL `process_contest_insurance`: eligible when `now() >= starts_at + 1 day`. */
export const CONTEST_INSURANCE_AFTER_START_MS = 24 * 60 * 60 * 1000;

export type ContestInsuranceLine = {
  kind: string;
  contest_entry_id: string;
  user_id: string;
  amount_usd: number;
};

export type ProcessContestInsurancePayload = {
  ok: true;
  contest_id: string;
  total_credited_usd: number;
  lines: ContestInsuranceLine[];
};

type RpcRow = {
  ok?: boolean;
  error?: string;
  contest_id?: string;
  total_credited_usd?: number;
  lines?: unknown;
};

function parseLines(raw: unknown): ContestInsuranceLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ContestInsuranceLine[] = [];
  for (const x of raw) {
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      out.push({
        kind: String(o.kind ?? ""),
        contest_entry_id: String(o.contest_entry_id ?? ""),
        user_id: String(o.user_id ?? ""),
        amount_usd: Number(o.amount_usd ?? 0),
      });
    }
  }
  return out;
}

/**
 * Runs DB `process_contest_insurance`: WD / missed-cut / overlay credits from `contest_insurance` config.
 * Idempotent per contest (`contest_insurance_runs`).
 */
export async function processContestInsurance(
  contestId: string,
): Promise<{ ok: true; data: ProcessContestInsurancePayload } | { ok: false; error: string }> {
  const id = contestId.trim();
  if (!id) {
    return { ok: false, error: "Missing contest id." };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const { data, error } = await admin.rpc("process_contest_insurance", { p_contest_id: id });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = data as RpcRow | null;
  if (!row || row.ok === false) {
    const msg =
      typeof row?.error === "string" && row.error.trim() !== ""
        ? row.error
        : "Insurance processing failed.";
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    data: {
      ok: true,
      contest_id: String(row.contest_id ?? id),
      total_credited_usd: Number(row.total_credited_usd ?? 0),
      lines: parseLines(row.lines),
    },
  };
}
