"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchMyEnteredContests, type MyEnteredContestRow } from "@/lib/my-contests-fetch";
import { supabase } from "@/lib/supabase/client";

export function useMyContestEntries() {
  const { user, isReady } = useAuth();
  const [rows, setRows] = useState<MyEnteredContestRow[]>([]);
  const [error, setError] = useState("");
  /** Starts true so `loading` stays set until the first post-auth fetch settles (avoids a one-frame flash). */
  const [fetching, setFetching] = useState(true);

  const loading = !isReady || fetching;

  const refresh = useCallback(async () => {
    if (!supabase) {
      setError("Missing Supabase env vars.");
      setFetching(false);
      return;
    }

    if (!isReady) {
      return;
    }

    setFetching(true);
    setError("");

    try {
      const currentUser: User | null = user;

      if (!currentUser) {
        setRows([]);
        return;
      }

      const { rows: data, error: fetchError } = await fetchMyEnteredContests(supabase, currentUser.id);
      if (fetchError) {
        setError(fetchError);
        setRows([]);
      } else {
        setRows(data);
        setError("");
      }
    } finally {
      setFetching(false);
    }
  }, [isReady, user]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!supabase) {
        if (!cancelled) {
          setError("Missing Supabase env vars.");
          setFetching(false);
        }
        return;
      }

      if (!isReady) {
        return;
      }

      setError("");

      if (!user) {
        if (!cancelled) {
          setRows([]);
          setFetching(false);
        }
        return;
      }

      setFetching(true);
      try {
        const { rows: data, error: fetchError } = await fetchMyEnteredContests(supabase, user.id);

        if (cancelled) return;

        if (fetchError) {
          setError(fetchError);
          setRows([]);
        } else {
          setRows(data);
          setError("");
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  return {
    user,
    rows,
    error,
    loading,
    sessionResolved: isReady,
    refresh,
  };
}
