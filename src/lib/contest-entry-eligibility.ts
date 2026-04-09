import type { SupabaseClient } from "@supabase/supabase-js";
import { isContestCancelled, CONTEST_CANCELLED_ENTRIES_MESSAGE } from "@/lib/contest-cancellation";
import { parseContestUuid } from "@/lib/contest-id";
import { CLOSED_BETA_ACCESS_MESSAGE, currentUserHasContestAccess } from "@/lib/supabase/beta-access";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Exact text from Postgres `create_contest_entry_atomic` / capacity trigger (map RPC errors with `normalizeContestEntryErrorMessage`). */
export const MAX_ENTRIES_REACHED_MESSAGE = "Maximum entries reached for this contest.";

/** User-facing: contest at global capacity. */
export const CONTEST_FULL_MESSAGE = "This contest is full — all entry spots are taken.";

/** User-facing: per-user entry cap (app + normalized RPC). */
export const ENTRY_LIMIT_PER_USER_MESSAGE =
  "You've reached your entry limit for this contest — no additional entries allowed.";

/** User-facing: after `starts_at` — no new entries and no lineup edits (align with `contest-lock-server`). */
export const CONTEST_LOCKED_MESSAGE =
  "This contest has locked — entries are closed and lineups can no longer be changed.";

/** Contest is draft, not yet published, or `contest_status` is not `open` for entry. */
export const CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE = "Contest not open for entries";

export const CONTEST_ENTRIES_CLOSED_MESSAGE = "Contest entries are closed.";

/** User-facing: contest past `ends_at` (if set). */
export const CONTEST_ENDED_MESSAGE = "This contest has ended — entries are no longer accepted.";

/** Lineup builder banner when user cannot add another paid entry for this contest. */
export const MAX_ENTRIES_PER_USER_LINEUP_BANNER_MESSAGE =
  "You already have the maximum entries for this contest.";

/** User-facing when wallet cannot cover the entry fee (after safety credit applied). */
export const INSUFFICIENT_FUNDS_MESSAGE = "Insufficient funds";

/** Closed beta: allow beta_user OR admin role OR founding_tester before contest entry / paid lineup flow. */
export async function assertClosedBetaApprovedForContestActions(
  supabase: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const hasAccess = await currentUserHasContestAccess(supabase);
  if (!hasAccess) {
    return { ok: false, error: CLOSED_BETA_ACCESS_MESSAGE };
  }
  return { ok: true };
}

/**
 * Map DB / PostgREST errors from `create_contest_entry_atomic` and triggers to stable product copy.
 */
export function normalizeContestEntryErrorMessage(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;
  if (t === "This contest is full." || /\bcontest is full\b/i.test(t)) {
    return CONTEST_FULL_MESSAGE;
  }
  if (t === MAX_ENTRIES_REACHED_MESSAGE || /\bmaximum entries reached\b/i.test(t)) {
    return ENTRY_LIMIT_PER_USER_MESSAGE;
  }
  if (
    /not open for entries yet/i.test(t) ||
    t === CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE ||
    /^contest not open for entries$/i.test(t)
  ) {
    return CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE;
  }
  if (/contest entries are closed/i.test(t) || t === CONTEST_ENTRIES_CLOSED_MESSAGE) {
    return CONTEST_ENTRIES_CLOSED_MESSAGE;
  }
  if (t === CONTEST_CANCELLED_ENTRIES_MESSAGE || /\bcancel(l)?ed contest\b/i.test(t)) {
    return CONTEST_CANCELLED_ENTRIES_MESSAGE;
  }
  if (
    /contest has started/i.test(t) ||
    /entries are closed/i.test(t) ||
    /lineups locked/i.test(t) ||
    t === CONTEST_LOCKED_MESSAGE
  ) {
    return CONTEST_LOCKED_MESSAGE;
  }
  if (/contest not found/i.test(t)) {
    return "Contest not found.";
  }
  if (/contest has ended/i.test(t) || /entries are no longer accepted/i.test(t)) {
    return CONTEST_ENDED_MESSAGE;
  }
  if (/insufficient account balance/i.test(t) || /insufficient funds for contest entry/i.test(t)) {
    return INSUFFICIENT_FUNDS_MESSAGE;
  }
  return raw;
}

/** Map capacity error to UI copy (banner uses lineup copy for per-user max). */
export function lineupBannerMessageForCapacityError(error: string): string {
  if (error === MAX_ENTRIES_REACHED_MESSAGE || error === ENTRY_LIMIT_PER_USER_MESSAGE) {
    return MAX_ENTRIES_PER_USER_LINEUP_BANNER_MESSAGE;
  }
  return error;
}

/** Server: non-null when user cannot start another paid entry for this contest (banner + disable pay). */
export async function getPayEntryBlockedBannerForUser(
  supabase: SupabaseClient,
  ctx: { contestId: string; userId: string },
): Promise<string | null> {
  const beta = await assertClosedBetaApprovedForContestActions(supabase);
  if (!beta.ok) {
    return beta.error;
  }
  const r = await assertContestEntryCapacityOk(supabase, ctx);
  if (r.ok) {
    return null;
  }
  return lineupBannerMessageForCapacityError(r.error);
}

export type EntryEligibilityContext = {
  contestId: string;
  userId: string;
  entryFeeUsd: number;
  protectionFeeUsd: number;
  /** When entering with an existing lineup, prevents duplicate entry for same roster. */
  lineupId?: string | null;
};

/**
 * Contest timing + global / per-user capacity only (no wallet, no duplicate-lineup).
 * Use before creating a new draft lineup tied to a contest when the user cannot enter again.
 */
export async function assertContestEntryCapacityOk(
  supabase: SupabaseClient,
  ctx: { contestId: string; userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const contestId = parseContestUuid(ctx.contestId.trim());
  if (!contestId) {
    return { ok: false, error: "Invalid contest id." };
  }

  const { data: c, error: cErr } = await supabase
    .from("contests")
    .select(
      "id, max_entries, max_entries_per_user, starts_at, ends_at, entry_fee_usd, contest_status, entries_open_at, created_at, status",
    )
    .eq("id", contestId)
    .maybeSingle();

  if (cErr || !c) {
    return { ok: false, error: "Contest not found." };
  }

  const row = c as {
    starts_at?: string | null;
    ends_at?: string | null;
    contest_status?: string | null;
    entries_open_at?: string | null;
    created_at?: string | null;
    status?: string | null;
  };
  if (isContestCancelled(row.contest_status, row.status)) {
    return { ok: false, error: CONTEST_CANCELLED_ENTRIES_MESSAGE };
  }
  const end = row.ends_at != null ? Date.parse(String(row.ends_at)) : NaN;
  if (Number.isFinite(end) && Date.now() > end) {
    return { ok: false, error: CONTEST_ENDED_MESSAGE };
  }

  const cs = String(row.contest_status ?? "").trim().toLowerCase();
  const legacy = String(row.status ?? "").trim().toLowerCase();
  let effectiveCs =
    cs ||
    (legacy === "open" || legacy === "full"
      ? "open"
      : legacy === "paid"
        ? "settled"
        : legacy);
  if (effectiveCs === "filling") {
    effectiveCs = "open";
  }

  if (effectiveCs === "draft" || effectiveCs === "upcoming") {
    return { ok: false, error: CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE };
  }
  if (
    effectiveCs === "settled" ||
    effectiveCs === "completed" ||
    effectiveCs === "cancelled" ||
    effectiveCs === "canceled" ||
    effectiveCs === "live"
  ) {
    return { ok: false, error: CONTEST_ENTRIES_CLOSED_MESSAGE };
  }
  if (effectiveCs === "locked") {
    return { ok: false, error: CONTEST_LOCKED_MESSAGE };
  }

  const openAtRaw = row.entries_open_at ?? row.created_at;
  const openMs = openAtRaw != null ? Date.parse(String(openAtRaw)) : NaN;
  if (Number.isFinite(openMs) && Date.now() < openMs) {
    return { ok: false, error: CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE };
  }

  const start = row.starts_at != null ? Date.parse(String(row.starts_at)) : NaN;
  if (Number.isFinite(start) && Date.now() >= start) {
    return { ok: false, error: CONTEST_LOCKED_MESSAGE };
  }

  if (effectiveCs !== "open") {
    return { ok: false, error: CONTEST_NOT_OPEN_FOR_ENTRIES_MESSAGE };
  }

  const maxE = Math.max(1, Math.floor(Number(c.max_entries ?? 1)));
  const maxPer = c.max_entries_per_user != null ? Math.floor(Number(c.max_entries_per_user)) : 999999;

  const { count: totalCount, error: tErr } = await supabase
    .from("contest_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId);

  if (tErr) {
    return { ok: false, error: tErr.message };
  }
  if ((totalCount ?? 0) >= maxE) {
    return { ok: false, error: CONTEST_FULL_MESSAGE };
  }

  const { count: userCount, error: uErr } = await supabase
    .from("contest_entries")
    .select("id", { count: "exact", head: true })
    .eq("contest_id", contestId)
    .eq("user_id", ctx.userId);

  if (uErr) {
    return { ok: false, error: uErr.message };
  }
  if ((userCount ?? 0) >= maxPer) {
    return { ok: false, error: ENTRY_LIMIT_PER_USER_MESSAGE };
  }

  return { ok: true };
}

/**
 * Pre-flight checks before creating a contest entry (app layer).
 * Wallet debit + `contest_entries` insert run atomically in Postgres via `create_contest_entry_atomic` (single transaction; prevents partial debit / double-spend on double-submit).
 * DB triggers also enforce:
 * - `trg_enforce_contest_entries_lock`: reject when `now() >= contests.starts_at` (late entries).
 * - `trg_enforce_contest_entry_capacity`: lock contest row; reject when at `max_entries` or `max_entries_per_user`.
 * Closed beta (`profiles.beta_user` or admin `role` or founding_tester) is enforced server-side.
 */
export async function assertContestEntryEligible(
  supabase: SupabaseClient,
  ctx: EntryEligibilityContext,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const betaOk = await assertClosedBetaApprovedForContestActions(supabase);
  if (!betaOk.ok) {
    return betaOk;
  }

  const capOk = await assertContestEntryCapacityOk(supabase, {
    contestId: ctx.contestId,
    userId: ctx.userId,
  });
  if (!capOk.ok) {
    return capOk;
  }

  const contestId = parseContestUuid(ctx.contestId.trim());
  if (!contestId) {
    return { ok: false, error: "Invalid contest id." };
  }

  const lid = ctx.lineupId?.trim();
  if (lid) {
    const { data: dup } = await supabase
      .from("contest_entries")
      .select("id")
      .eq("contest_id", contestId)
      .eq("lineup_id", lid)
      .maybeSingle();
    if (dup?.id) {
      return {
        ok: false,
        error:
          "This lineup is already entered in this contest — duplicate entries are not allowed for the same roster.",
      };
    }
  }

  const entryFee = round2(Math.max(0, ctx.entryFeeUsd));
  /** User pays entry fee only; `protectionFeeUsd` on context is legacy — wallet check uses entry fee. */
  const total = entryFee;

  if (total > 0) {
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("account_balance,protection_credit_balance")
      .eq("id", ctx.userId)
      .maybeSingle();

    if (pErr) {
      return { ok: false, error: pErr.message };
    }
    const bal = round2(Number(prof?.account_balance ?? 0));
    const pc = round2(Number(prof?.protection_credit_balance ?? 0));
    const fromPc = round2(Math.min(total, Math.max(0, pc)));
    const needCash = round2(total - fromPc);

    if (needCash > bal) {
      return { ok: false, error: INSUFFICIENT_FUNDS_MESSAGE };
    }
  }

  return { ok: true };
}
