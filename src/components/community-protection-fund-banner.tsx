"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { supabase } from "@/lib/supabase/client";

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

export function CommunityProtectionFundBanner() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [poolTableMissing, setPoolTableMissing] = useState(false);
  const hasSupabase = useMemo(() => !!supabase, []);

  const fetchBalance = useCallback(async () => {
    const sb = supabase;
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
    const sb = supabase;
    if (!sb || loading || poolTableMissing) {
      return;
    }

    let channel: ReturnType<typeof sb.channel> | null = null;
    try {
      channel = sb
        .channel("insurance_pool_balance")
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
    <div
      className="safetyFundCard goldCard group relative max-w-full min-w-0 shrink cursor-default overflow-hidden p-5 backdrop-blur-sm transition-all duration-[250ms] ease-in-out sm:min-w-[15rem]"
    >
      <p id="safety-fund-tooltip-desc" className="sr-only">
        {SAFETY_FUND_TOOLTIP}
      </p>
      <div className="flex flex-col gap-0.5 transition-opacity duration-200 ease-out group-hover:opacity-[0.12]" aria-hidden="true">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200/95">
          Safety Coverage Fund
        </p>
        <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-emerald-300 sm:text-xl" aria-live="polite">
          {loading ? "…" : formatPoolUsd(balance ?? 0)}
        </p>
        <p className="text-[10px] leading-snug text-slate-400 sm:text-[11px]">
          Funded by protected entry fees.
        </p>
      </div>
      <div
        role="tooltip"
        className="pointer-events-none absolute inset-0 z-10 flex min-h-full items-center justify-center border-2 border-[#d4af37] bg-[#020617]/95 px-3 py-3 opacity-0 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.25)] transition-opacity duration-200 ease-out group-hover:opacity-100 sm:px-4 sm:py-4"
        aria-hidden="true"
      >
        <p className="max-w-[20rem] text-center text-[13px] leading-[1.55] text-slate-100 sm:text-sm sm:leading-relaxed">
          {SAFETY_FUND_TOOLTIP}
        </p>
      </div>
    </div>
  );
}
