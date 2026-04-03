import { notFound } from "next/navigation";
import { ContestDbDetail } from "@/components/contest-db-detail";
import { fetchContestPayoutsForContest, fetchLobbyContestById } from "@/lib/contest-lobby-fetch";

type ContestDetailsPageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function LobbyContestDetailsPage(props: ContestDetailsPageProps) {
  const { contestId: raw } = await props.params;
  const contestId = raw?.trim() ?? "";
  if (!contestId) {
    notFound();
  }

  const row = await fetchLobbyContestById(contestId);
  if (!row) {
    notFound();
  }

  const payouts = await fetchContestPayoutsForContest(contestId);

  return <ContestDbDetail contestId={contestId} row={row} payouts={payouts} />;
}
