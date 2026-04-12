import { notFound } from "next/navigation";
import { getContestLeaderboard } from "@/lib/supabase/queries/getContestLeaderboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestLeaderboardPage(props: PageProps) {
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";

  const { rows, contestExists } = await getContestLeaderboard(id);

  const supabase = await createClient();
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

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No entries yet</p>
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500">
              <th className="w-14 pb-2 pr-2 text-center font-medium">Order</th>
              <th className="w-24 pb-2 pr-2 text-center font-medium">Entry</th>
              <th className="pb-2 pr-4 text-left font-medium">Username</th>
              <th className="w-24 pb-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSelf = currentUserId != null && r.user_id === currentUserId;
              return (
                <tr
                  key={`${r.order}-${r.user_id}-${r.entryNumber}-${i}`}
                  className={`border-b border-slate-800/80 ${isSelf ? "bg-slate-800" : ""}`}
                >
                  <td className="py-2 pr-2 text-center tabular-nums text-slate-200">{r.order}</td>
                  <td className="py-2 pr-2 text-center text-slate-200">Entry {r.entryNumber}</td>
                  <td className="py-2 pr-4 text-slate-200">{r.username}</td>
                  <td className="py-2 text-right tabular-nums text-slate-200">{r.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
