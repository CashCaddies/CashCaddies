import Link from "next/link";
import { AdminDashboardMetricsPanel } from "@/components/admin-dashboard-metrics-panel";
import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export default async function AdminStatsPage() {
  await requireUser();
  await requireAdmin();

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Stats</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          Analytics and reporting will appear here.{" "}
          <Link href="/dashboard/admin/waitlist" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Access requests
          </Link>
          {" · "}
          <Link href="/admin/contests" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Create Contest
          </Link>
          {" · "}
          <Link href="/admin/scoring" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Scoring
          </Link>
          {" · "}
          <Link href="/admin/settlement" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Settlement
          </Link>
          {" · "}
          <Link href="/admin/payout-history" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            View Payouts
          </Link>
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Platform metrics</h2>
          <p className="text-sm text-[#8b98a5]">
            Totals from <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">admin_dashboard_metrics</code>{" "}
            (deposits, entry fees, payouts from ledgers).
          </p>
          <AdminDashboardMetricsPanel />
        </div>
      </div>
    </div>
  );
}
