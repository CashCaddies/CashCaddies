"use client";

import { useEffect, useState } from "react";
import { getAdminMetrics, type AdminDashboardMetrics } from "@/app/admin/admin-dashboard-metrics";

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function AdminDashboardMetricsPanel() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getAdminMetrics();
      if (cancelled) return;
      if (!res.ok) {
        setMetrics(null);
        setError(res.error);
        setLoading(false);
        return;
      }
      setMetrics(res.data);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-[#2a3039] bg-[#141920]/60 px-6 py-8 text-sm text-[#8b98a5]">Loading metrics…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/25 px-6 py-4 text-sm text-amber-100/90">{error}</div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Total users</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatInt(metrics.total_users)}</p>
      </div>
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Total deposits</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300">{formatMoney(metrics.total_deposits)}</p>
      </div>
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Entry fees</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatMoney(metrics.total_entry_fees)}</p>
      </div>
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Payouts</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatMoney(metrics.total_payouts)}</p>
      </div>
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Profit</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300">{formatMoney(metrics.profit)}</p>
      </div>
      <div className="rounded-xl border border-[#2a3039] bg-[#141920] p-5">
        <p className="text-sm font-medium text-[#8b98a5]">Active contests</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white">{formatInt(metrics.active_contests)}</p>
      </div>
    </div>
  );
}
