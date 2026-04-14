export const dynamic = "force-dynamic";

import { fetchLobbyContests } from "@/lib/contest-lobby-fetch";
import { LobbyPageContent } from "@/components/lobby-page-content";

export default async function LobbyPage() {
  const { contests, error } = await fetchLobbyContests();

  return <LobbyPageContent contests={contests} error={error} />;
}
