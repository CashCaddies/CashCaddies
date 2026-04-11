import { notFound } from "next/navigation";
import { getContestLeaderboard } from "@/lib/supabase/queries/getContestLeaderboard";
import { formatMoney } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestLeaderboardPage(props: PageProps) {
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";

  const { rows, contestExists } = await getContestLeaderboard(id);

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
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="pb-2 pr-4 font-medium">Rank</th>
              <th className="pb-2 pr-4 font-medium">Username</th>
              <th className="pb-2 pr-4 font-medium">Score</th>
              <th className="pb-2 font-medium">Winnings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.rank}-${r.user_id}-${i}`} className="border-b border-slate-800/80">
                <td className="py-2 pr-4 tabular-nums text-slate-200">{r.rank}</td>
                <td className="py-2 pr-4 text-slate-200">{r.username}</td>
                <td className="py-2 pr-4 tabular-nums text-slate-200">{r.score}</td>
                <td className="py-2 tabular-nums text-slate-200">
                  {r.winnings == null ? "-" : formatMoney(r.winnings)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
