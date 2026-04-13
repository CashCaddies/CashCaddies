"use client";

import { useEffect, useState } from "react";
import { LobbyPageContent } from "@/components/lobby-page-content";
import useRequireAuth from "@/hooks/useRequireAuth";
import type { LobbyContestRow } from "@/lib/contest-lobby-shared";
import { loadLobbyPageContests } from "./actions";

export default function LobbyPage() {
  const loading = useRequireAuth();
  const [payload, setPayload] = useState<{
    contests: LobbyContestRow[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadLobbyPageContests().then((result) => {
      if (!cancelled) setPayload(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (payload === null) return null;

  return <LobbyPageContent contests={payload.contests} error={payload.error} />;
}
