"use server";

import { unstable_noStore } from "next/cache";
import { getContestLeaderboard } from "@/lib/supabase/queries/getContestLeaderboard";

const POLL_INTERVAL_MS = 15_000;

/** Server action for client polling — no Next fetch cache. */
export async function pollContestLeaderboard(contestId: string) {
  unstable_noStore();
  return getContestLeaderboard(contestId.trim());
}

export const CONTEST_LEADERBOARD_POLL_MS = POLL_INTERVAL_MS;
