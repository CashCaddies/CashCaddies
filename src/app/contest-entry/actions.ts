"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { assertContestEntryEligible } from "@/lib/contest-entry-eligibility";
import { parseContestUuid } from "@/lib/contest-id";
import {
  chargeContestEntry,
  type DebitSnapshot,
} from "@/lib/contest-entry-payment";

export type CreateContestEntryResult =
  | { ok: true; snapshot: DebitSnapshot }
  | { ok: false; error: string };

/**
 * Creates a contest entry and debits the wallet in one database transaction
 * (via `create_contest_entry_atomic` when using the atomic path).
 * Requires an authenticated user; uses the service role for billing RPCs.
 */
export async function createContestEntry(payload: {
  contestId: string;
  contestName: string;
  entryFeeUsd: number;
  protectionFeeUsd: number;
  protectionEnabled: boolean;
  lineupId?: string | null;
  accountBalanceOnly?: boolean;
}): Promise<CreateContestEntryResult> {
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
    return { ok: false, error: "You must be logged in." };
  }

  const contestIdNorm = parseContestUuid(payload.contestId.trim());
  if (!contestIdNorm) {
    return { ok: false, error: "Invalid contest id." };
  }

  const preEntry = await assertContestEntryEligible(supabase, {
    contestId: contestIdNorm,
    userId: user.id,
    entryFeeUsd: payload.entryFeeUsd,
    protectionFeeUsd: payload.protectionFeeUsd,
    lineupId: payload.lineupId ?? null,
  });
  if (!preEntry.ok) {
    return { ok: false, error: preEntry.error };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Server billing is not configured. Set SUPABASE_SERVICE_ROLE_KEY for contest entry creation.",
    };
  }

  return chargeContestEntry(admin, {
    userId: user.id,
    contestId: contestIdNorm,
    contestName: payload.contestName.trim() || "Contest",
    entryFeeUsd: payload.entryFeeUsd,
    protectionFeeUsd: payload.protectionFeeUsd,
    protectionEnabled: payload.protectionEnabled,
    lineupId: payload.lineupId,
    accountBalanceOnly: payload.accountBalanceOnly,
  });
}
