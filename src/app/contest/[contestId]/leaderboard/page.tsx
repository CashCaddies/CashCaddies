import { notFound } from "next/navigation";
import LiveLeaderboard from "./live-leaderboard";
import { getContestLeaderboard } from "@/lib/supabase/queries/getContestLeaderboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestLiveLeaderboardPage(props: PageProps) {
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";

  const { contestExists } = await getContestLeaderboard(id);
  if (!contestExists) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-white">Live Leaderboard</h1>
      <LiveLeaderboard contestId={id} />
    </div>
  );
}
