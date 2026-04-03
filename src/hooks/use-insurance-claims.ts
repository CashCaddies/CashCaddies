"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type InsuranceClaimRow = {
  id: string;
  lineup_id: string;
  golfer_id: string;
  claim_type: string;
  status: string;
  created_at: string;
  /** Set when a refund-type claim is approved (USD). */
  refund_amount_usd?: number | null;
};

function claimKey(lineupId: string, golferId: string) {
  return `${lineupId}::${golferId}`;
}

/** Latest claim per lineup + golfer (by created_at). */
function mergeLatest(rows: InsuranceClaimRow[]): Map<string, InsuranceClaimRow> {
  const map = new Map<string, InsuranceClaimRow>();
  for (const c of rows) {
    const k = claimKey(c.lineup_id, c.golfer_id);
    const prev = map.get(k);
    if (!prev || new Date(c.created_at) > new Date(prev.created_at)) {
      map.set(k, c);
    }
  }
  return map;
}

export function useInsuranceClaims(lineupIds: string[]) {
  const [byKey, setByKey] = useState<Map<string, InsuranceClaimRow>>(new Map());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase || lineupIds.length === 0) {
      setByKey(new Map());
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("insurance_claims")
      .select("id, lineup_id, golfer_id, claim_type, status, created_at, refund_amount_usd")
      .in("lineup_id", lineupIds);

    if (fetchError) {
      setError(fetchError.message);
      setByKey(new Map());
    } else {
      setByKey(mergeLatest((data ?? []) as InsuranceClaimRow[]));
    }
    setLoading(false);
  }, [lineupIds]);

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  function getClaim(lineupId: string, golferId: string): InsuranceClaimRow | undefined {
    return byKey.get(claimKey(lineupId, golferId));
  }

  return { getClaim, byKey, error, loading, refresh };
}
