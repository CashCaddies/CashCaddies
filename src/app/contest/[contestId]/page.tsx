import { notFound } from "next/navigation";
import { ContestLeaderboardLive } from "@/app/contest/[contestId]/contest-leaderboard-live";
import { getContestLeaderboard } from "@/lib/supabase/queries/getContestLeaderboard";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestLeaderboardPage(props: PageProps) {
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";

  const { rows, contestExists } = await getContestLeaderboard(id);

    const {
    data: { user },
  } = await supabase.auth.getUser();
  const currentUserId = user?.id ?? null;

  if (!contestExists) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-white">Contest Leaderboard</h1>

      <ContestLeaderboardLive contestId={id} initialRows={rows} currentUserId={currentUserId} />
    </div>
  );
}
