"use client";

import Link from "next/link";
import { Activity, Crown, Lock, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { APP_CONFIG_DEFAULT_MAX_BETA_USERS } from "@/lib/config";
import { fetchInsurancePoolBalanceUsd } from "@/lib/insurance-pool-balance";
import { isAdmin } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";

function formatPoolUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const ROTATION_MS = 5000;

/** Static coverage copy — avoid em dash / double-dash variants that diverge across SSR and client. */
const COVERAGE_TEXT = "Covers WD, DQ, DNS";

type TickerIcon = "shield" | "crown" | "lock" | "activity";

const BETA_REQUEST_MAILTO =
  "mailto:contact@cashcaddies.com?subject=CashCaddies%20Beta%20Request";

type TickerMessage = {
  label: string;
  value: string;
  href: string;
  icon: TickerIcon;
  /** When set, the value is a mailto link (row is not wrapped in Next `Link`). */
  valueMailto?: string;
};

const iconByKey: Record<TickerIcon, typeof Shield> = {
  shield: Shield,
  crown: Crown,
  lock: Lock,
  activity: Activity,
};

/** Full-width rotating status strip: auto-rotate, pause on hover, manual arrows, fade + slide. */
export function HeaderFundBar() {
  const { fullUser } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [fundBalance, setFundBalance] = useState<number | null>(null);
  const [fundLoading, setFundLoading] = useState(true);
  const [betaApproved, setBetaApproved] = useState<number | null>(null);
  const [betaMax, setBetaMax] = useState<number | null>(null);
  const [betaStatsLoading, setBetaStatsLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasSupabase = useMemo(() => !!supabase, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchFund = useCallback(async () => {
    const sb = supabase;
    if (!sb) {
      setFundBalance(null);
      setFundLoading(false);
      return;
    }
    const { usd, tableMissing } = await fetchInsurancePoolBalanceUsd(sb);
    setFundBalance(tableMissing ? 0 : usd);
    setFundLoading(false);
  }, []);

  const fetchBetaStats = useCallback(async () => {
    setBetaStatsLoading(true);
    try {
      const res = await fetch("/api/closed-beta/stats", { cache: "no-store" });
      if (!res.ok) {
        setBetaApproved(null);
        setBetaMax(null);
        setBetaStatsLoading(false);
        return;
      }
      const json = (await res.json()) as { approved?: unknown; maxBetaUsers?: unknown };
      setBetaApproved(Number(json.approved ?? 0));
      setBetaMax(Number(json.maxBetaUsers ?? APP_CONFIG_DEFAULT_MAX_BETA_USERS));
    } catch {
      setBetaApproved(null);
      setBetaMax(null);
    }
    setBetaStatsLoading(false);
  }, []);

  useEffect(() => {
    void fetchFund();
  }, [fetchFund]);

  useEffect(() => {
    void fetchBetaStats();
  }, [fetchBetaStats]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchFund();
        void fetchBetaStats();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchFund, fetchBetaStats]);

  const display = !hasSupabase ? "" : fundLoading ? "…" : formatPoolUsd(fundBalance ?? 0);

  const safetyCoverageValue = !hasSupabase
    ? COVERAGE_TEXT
    : fundLoading
      ? `… ${COVERAGE_TEXT}`
      : `${display} ${COVERAGE_TEXT}`;

  const foundingBetaValue =
    betaStatsLoading || betaApproved == null || betaMax == null
      ? "…"
      : `${betaApproved} / ${betaMax} spots filled`;

  const messages: TickerMessage[] = useMemo(() => {
    const base: TickerMessage[] = [
      {
        label: "Safety Coverage Fund",
        value: safetyCoverageValue,
        href: "/faq#safety-coverage",
        icon: "shield",
      },
      {
        label: "Closed beta",
        value: foundingBetaValue,
        href: "/admin/beta",
        icon: "crown",
      },
      {
        label: "Closed Beta",
        value: "Invite Only",
        href: "/faq",
        icon: "lock",
      },
    ];
    if (isAdmin(fullUser?.role)) {
      base.push({
        label: "Admin Monitoring",
        value: "Active",
        href: "/dashboard/admin",
        icon: "activity",
      });
    }
    return base;
  }, [safetyCoverageValue, foundingBetaValue, fullUser?.role]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, messages.length - 1)));
  }, [messages.length]);

  useEffect(() => {
    if (paused) return;
    if (messages.length === 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, ROTATION_MS);
    return () => clearInterval(interval);
  }, [paused, messages.length]);

  const goPrev = () => {
    setIndex((prev) => (prev === 0 ? messages.length - 1 : prev - 1));
  };

  const goNext = () => {
    setIndex((prev) => (prev + 1) % messages.length);
  };

  const current = messages[index];
  const Icon = current ? iconByKey[current.icon] : Shield;

  const rowClassName =
    "group flex min-w-0 max-w-full items-center justify-center gap-3 px-4 py-1 cursor-pointer opacity-100 transition-all duration-300 ease-in-out hover:opacity-80 hover:scale-[1.02] animate-fade motion-reduce:animate-none";

  const valueClassName =
    "text-emerald-400 opacity-90 tracking-wide drop-shadow-[0_0_6px_rgba(52,211,153,0.20)] transition-colors duration-200 group-hover:text-emerald-300";

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="statusBar"
      title="Platform status and Safety Coverage Fund. Fund balance covers WD, DQ, DNS when applicable."
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        type="button"
        className="statusArrow opacity-40 transition-opacity duration-200 hover:opacity-100"
        aria-label="Previous status"
        onClick={goPrev}
      >
        ‹
      </button>

      <div className="statusContent min-w-0 flex-1 justify-center" key={index}>
        {current?.valueMailto ? (
          <div className={rowClassName}>
            <Icon
              className="h-[18px] w-[18px] shrink-0 text-amber-400/90 opacity-80 transition-all duration-300 group-hover:opacity-100 motion-reduce:transition-none"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 text-center transition-all duration-500 ease-in-out">
              <span className="text-yellow-400 font-semibold tracking-wide drop-shadow-[0_0_6px_rgba(250,204,21,0.25)] transition-colors duration-200 group-hover:text-yellow-300">
                {current.label}
              </span>
              <span className="text-yellow-400/40 mx-2">•</span>
              <a href={current.valueMailto} className={valueClassName}>
                {current.value}
              </a>
            </span>
          </div>
        ) : (
          <Link href={current?.href ?? "/"} className={rowClassName}>
            <Icon
              className="h-[18px] w-[18px] shrink-0 text-amber-400/90 opacity-80 transition-all duration-300 group-hover:opacity-100 motion-reduce:transition-none"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 text-center transition-all duration-500 ease-in-out">
              <span className="text-yellow-400 font-semibold tracking-wide drop-shadow-[0_0_6px_rgba(250,204,21,0.25)] transition-colors duration-200 group-hover:text-yellow-300">
                {current?.label ?? ""}
              </span>
              <span className="text-yellow-400/40 mx-2">•</span>
              <span className={valueClassName}>{current?.value ?? ""}</span>
            </span>
          </Link>
        )}
      </div>

      <button
        type="button"
        className="statusArrow opacity-40 transition-opacity duration-200 hover:opacity-100"
        aria-label="Next status"
        onClick={goNext}
      >
        ›
      </button>
    </div>
  );
}
