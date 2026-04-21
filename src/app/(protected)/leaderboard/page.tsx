import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";

/**
 * Hub for contest leaderboards — pick a contest from the lobby to view live rankings.
 */
export default async function LeaderboardPage() {
  await requireUser();
  return (
    <div className="pageWrap py-10">
      <h1 className="text-2xl font-bold text-white">Leaderboards</h1>
      <p className="mt-3 max-w-xl text-slate-400">
        Leaderboards are available per contest. Open the lobby, choose a contest, then view rankings or enter from there.
      </p>
      <Link href="/lobby" className="ccLink mt-6 inline-block">
        Go to Lobby
      </Link>
    </div>
  );
}
