"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/wallet";
import { RecentAdminActivity } from "@/components/recent-admin-activity";

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconDollar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function DashboardAdminCommandCenterPage() {
  const { user, isReady } = useAuth();
  const [users, setUsers] = useState<number | null>(null);
  const [approvedBeta, setApprovedBeta] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [totalBetaWalletUsd, setTotalBetaWalletUsd] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!isReady || !user || !supabase) {
      if (isReady && !user) setLoadingStats(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [totalRes, approvedRes, pendingRes, walletRes] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("beta_user", true)
            .eq("beta_status", "approved"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("beta_status", "pending"),
          supabase
            .from("profiles")
            .select("account_balance")
            .or("beta_user.eq.true,beta_status.eq.approved,beta_status.eq.pending"),
        ]);
        if (cancelled) return;
        setUsers(totalRes.error ? 0 : Number(totalRes.count ?? 0));
        setApprovedBeta(approvedRes.error ? 0 : Number(approvedRes.count ?? 0));
        setPending(pendingRes.error ? 0 : Number(pendingRes.count ?? 0));
        if (walletRes.error || !walletRes.data) {
          setTotalBetaWalletUsd(0);
        } else {
          const sum = walletRes.data.reduce(
            (acc: number, row: { account_balance?: number | string | null }) =>
              acc + Number(row.account_balance ?? 0),
            0,
          );
          setTotalBetaWalletUsd(sum);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  if (!isReady) {
    return <p className="text-slate-400">Loadingâ€¦</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="pageWrap py-8">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Command Center</h1>
        <p className="mt-1 text-sm text-slate-400">Key metrics and shortcuts for operations.</p>
      </header>

      <div className="adminGrid">
        <div className="adminCard transition-all duration-200 hover:border-yellow-500/40">
          <div className="flex items-center gap-2">
            <IconUser className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Users</span>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {loadingStats ? "â€¦" : (users ?? "â€”")}
          </p>
        </div>

        <div className="adminCard shadow-[0_0_24px_rgba(34,197,94,0.2)] transition-all duration-200 hover:border-yellow-500/40">
          <div className="flex items-center gap-2">
            <IconCheck className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approved Beta</span>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-green-400">
            {loadingStats ? "â€¦" : (approvedBeta ?? "â€”")}
          </p>
        </div>

        <Link
          href="/dashboard/admin/waitlist"
          className="adminCard block cursor-pointer shadow-[0_0_24px_rgba(56,189,248,0.15)] transition-all duration-200 hover:border-sky-400/35 hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <IconClock className="h-4 w-4 shrink-0 text-sky-400/90" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Waitlist manager</span>
            </div>
            <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500/60" />
          </div>
          <p className="mt-3 text-sm font-medium text-sky-200/90">Prelaunch signups</p>
          <p className="mt-2 text-xs text-muted-foreground">/early-access</p>
        </Link>

        <Link
          href="/dashboard/admin/beta-queue"
          className="adminCard block cursor-pointer shadow-[0_0_24px_rgba(234,179,8,0.2)] transition-all duration-200 hover:border-yellow-400/40 hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500/50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <IconClock className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending Beta</span>
            </div>
            <IconArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500/60" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-yellow-400">
            {loadingStats ? "â€¦" : (pending ?? "â€”")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Click to review</p>
        </Link>

        <div className="adminCard shadow-[0_0_24px_rgba(250,204,21,0.2)] transition-all duration-200 hover:border-yellow-500/40">
          <div className="flex items-center gap-2">
            <IconDollar className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Beta Wallet</span>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-yellow-300">
            {loadingStats ? "â€¦" : totalBetaWalletUsd === null ? "â€”" : formatMoney(totalBetaWalletUsd)}
          </p>
        </div>
      </div>

      <div className="adminActions">
        <Link href="/admin/contests" className="adminAction">
          Create Contest
        </Link>
        <Link href="/dashboard/admin/beta-queue" className="adminAction">
          View Beta Queue
        </Link>
        <Link href="/dashboard/feedback" className="adminAction">
          Feedback Inbox
        </Link>
      </div>

      <RecentAdminActivity />
    </div>
  );
}
