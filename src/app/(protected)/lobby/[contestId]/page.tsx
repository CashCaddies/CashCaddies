import { notFound } from "next/navigation";
import { ContestDbDetail } from "@/components/contest-db-detail";
import { fetchLobbyContestById } from "@/lib/contest-lobby-fetch";
import { requireUser } from "@/lib/auth/require-user";

type ContestDetailsPageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function LobbyContestDetailsPage(props: ContestDetailsPageProps) {
  await requireUser();
  const { contestId: raw } = await props.params;
  const contestId = raw?.trim() ?? "";
  if (!contestId) {
    notFound();
  }

  const row = await fetchLobbyContestById(contestId);
  if (!row) {
    notFound();
  }

  return <ContestDbDetail contestId={contestId} row={row} />;
}
