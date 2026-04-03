"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { createClient } from "@/lib/supabase/client";

const SAFETY_FUND_TOOLTIP =
  "Safety Coverage Fund balance. Provides entry fee protection when golfers WD, DQ, or DNS.";

function formatPoolUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Compact Safety Fund balance for the main header (right column). */
export function HeaderSafetyFundChip() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [poolTableMissing, setPoolTableMissing] = useState(false);
  const hasSupabase = useMemo(() => createClient() !== null, []);

  const fetchBalance = useCallback(async () => {
    const sb = createClient();
    if (!sb) {
      setBalance(null);
      setPoolTableMissing(true);
      setLoading(false);
      return;
    }
    const { usd, tableMissing } = await fetchInsurancePoolBalanceUsd(sb);
    setPoolTableMissing(tableMissing);
    setBalance(tableMissing ? null : usd);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchBalance();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchBalance]);

  useEffect(() => {
    const sb = createClient();
    if (!sb || loading || poolTableMissing) {
      return;
    }

    let channel: ReturnType<typeof sb.channel> | null = null;
    try {
      channel = sb
        .channel("header_insurance_pool_balance")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "insurance_pool" },
          () => {
            void fetchBalance();
          },
        )
        .subscribe();
    } catch {
      /* optional table / realtime */
    }

    return () => {
      if (channel && sb) void sb.removeChannel(channel);
    };
  }, [fetchBalance, loading, poolTableMissing]);

  if (!hasSupabase) {
    return null;
  }

  return (
    <div className="fundCard" title={SAFETY_FUND_TOOLTIP}>
      Safety Fund
      <span className="fundAmount">{loading ? "…" : formatPoolUsd(balance ?? 0)}</span>
    </div>
  );
}
