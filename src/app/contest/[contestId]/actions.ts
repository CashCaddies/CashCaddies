"use server";

import { unstable_noStore } from "next/cache";
import { getLeaderboardForContest } from "@/lib/contest-leaderboard-data";

/** Explicit Supabase-backed refetch for the contest leaderboard (no Next fetch cache). */
export async function refetchContestLeaderboard(contestId: string) {
  unstable_noStore();
  return getLeaderboardForContest(contestId.trim());
}
