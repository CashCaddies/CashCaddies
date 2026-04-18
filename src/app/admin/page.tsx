"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchAdminCommandCenterStats } from "@/app/admin/command-center-stats";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import ResponsesTable from "@/components/admin/responses-table";
import { AdminTriggerSettlement } from "@/components/admin-trigger-settlement";
import { isOwner } from "@/lib/userRoles";
import { supabase } from "@/lib/supabase/client";

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="goldCard flex h-full min-h-[128px] flex-col justify-center p-5 transition-colors hover:border-emerald-500/35 hover:bg-slate-900/90">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1419]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="h-full">{inner}</div>;
}

export default function AdminControlCenterPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const { fullUser, loading: walletLoading } = useWallet();
  const [pendingBeta, setPendingBeta] = useState(0);
  const [approvedBeta, setApprovedBeta] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalWalletUsd, setTotalWalletUsd] = useState(0);
  const [protectionFundUsd, setProtectionFundUsd] = useState(0);
  const [contestCount, setContestCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const isAdminUser = isOwner(user?.email);

  useEffect(() => {
    const check = async () => {
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;

      if (!isOwner(email)) {
        router.replace("/login");
      }
    };

    void check();
  }, [router]);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    const res = await fetchAdminCommandCenterStats();
    if (!res.ok) {
      setStatsError(res.error);
      setTotalUsers(0);
      setPendingBeta(0);
      setApprovedBeta(0);
      setTotalWalletUsd(0);
      setProtectionFundUsd(0);
      setContestCount(0);
      return;
    }
    setTotalUsers(res.totalUsers);
    setPendingBeta(res.pendingBeta);
    setApprovedBeta(res.approvedBeta);
    setTotalWalletUsd(res.totalWalletUsd);
    setProtectionFundUsd(res.protectionFundUsd);
    setContestCount(res.contestCount);
  }, []);

  useEffect(() => {
    if (!isReady || walletLoading) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      if (!session?.user) {
        if (!cancelled) setLoadingStats(false);
        return;
      }
      if (!isOwner(userEmail)) {
        router.replace("/login");
        if (!cancelled) setLoadingStats(false);
        return;
      }
      try {
        await loadStats();
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, loadStats, router, walletLoading]);

  if (!isReady || walletLoading || loadingStats) {
    return <p className="text-slate-400">Loading…</p>;
  }

  if (!user || !isAdminUser) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="goldCard p-6">
        <h1 className="text-3xl font-bold text-white">Admin Control Center</h1>
        <p className="mt-2 text-sm text-slate-400">Founder tools for beta operations and contest management.</p>
        {statsError ? (
          <p className="mt-3 text-sm text-amber-400" role="alert">
            {statsError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total users" value={formatInt(totalUsers)} href="/admin/users" />
        <StatCard title="Approved beta" value={formatInt(approvedBeta)} />
        <StatCard title="Pending beta" value={formatInt(pendingBeta)} href="/admin/beta-queue" />
        <StatCard title="Total wallet" value={formatMoney(totalWalletUsd)} />
        <StatCard title="Contests" value={formatInt(contestCount)} href="/admin/contests" />
        <StatCard title="Protection fund" value={formatMoney(protectionFundUsd)} />
      </div>

      <AdminTriggerSettlement />

      <ResponsesTable />
    </div>
  );
}
