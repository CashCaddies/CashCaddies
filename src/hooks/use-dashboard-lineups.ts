"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchDashboardLineups, type DashboardLineup } from "@/lib/dashboard-lineups";
import { supabase } from "@/lib/supabase/client";

/** Refresh often when the user has a paid contest entry; less often when only drafts / empty (fewer Supabase round-trips). */
const POLL_MS_WITH_ENTRY = 30_000;
const POLL_MS_NO_ENTRY = 120_000;

export function useDashboardLineups() {
  const { user, isReady } = useAuth();
  const [lineups, setLineups] = useState<DashboardLineup[]>([]);
  const [error, setError] = useState("");
  const [fetching, setFetching] = useState(true);
  const [pollMs, setPollMs] = useState(POLL_MS_NO_ENTRY);

  const loading = !isReady || fetching;

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Missing Supabase env vars.");
      setFetching(false);
      return;
    }
    if (!isReady) {
      return;
    }

    if (!user) {
      setLineups([]);
      setFetching(false);
      setPollMs(POLL_MS_NO_ENTRY);
      return;
    }

    setFetching(true);
    setError("");

    try {
      const { lineups: rows, error: fetchError } = await fetchDashboardLineups(supabase, user.id);
      if (fetchError) {
        setError(fetchError);
        setLineups([]);
        setPollMs(POLL_MS_NO_ENTRY);
      } else {
        setLineups(rows);
        const hasContestEntry = rows.some((r) => r.contest_entry_id != null);
        setPollMs(hasContestEntry ? POLL_MS_WITH_ENTRY : POLL_MS_NO_ENTRY);
      }
    } finally {
      setFetching(false);
    }
  }, [isReady, user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!supabase) {
      return;
    }
    /* No background refresh when there are no lineups â€” avoids repeat round-trips (contest_entries only runs when entries exist). */
    if (lineups.length === 0) {
      return;
    }
    const id = window.setInterval(() => {
      void load();
    }, pollMs);
    return () => window.clearInterval(id);
  }, [user, load, pollMs, lineups.length]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { user, lineups, error, loading, refresh };
}
