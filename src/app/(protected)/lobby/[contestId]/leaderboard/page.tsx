import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ contestId: string }>;
};

/** Leaderboard lives at `/contest/[contestId]`. */
export default async function ContestLeaderboardRedirectPage(props: Props) {
  await requireUser();
  const { contestId } = await props.params;
  const id = contestId?.trim() ?? "";
  if (!id) {
    redirect("/lobby");
  }
  redirect(`/contest/${encodeURIComponent(id)}`);
}
