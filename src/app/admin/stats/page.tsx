import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminNewFeedbackCount } from "@/app/admin/feedback/actions";
import { AdminHubNav } from "@/components/admin-hub-nav";
import { AdminDashboardMetricsPanel } from "@/components/admin-dashboard-metrics-panel";
import { supabase } from "@/lib/supabase/client";
import { isOwner } from "@/lib/userRoles";

export default async function AdminStatsPage() {
    const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  if (!isOwner(user.email)) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("founding_tester, role")
    .eq("id", user.id)
    .maybeSingle();

  const foundingTester = profile?.founding_tester === true;
  const adminUser = true;

  let feedbackUnreadCount: number | undefined;
  if (adminUser) {
    const fc = await getAdminNewFeedbackCount();
    feedbackUnreadCount = fc.ok ? fc.count : undefined;
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Stats</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          Analytics and reporting will appear here.{" "}
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
        <AdminHubNav
          section="stats"
          foundingTester={foundingTester}
          adminUser={adminUser}
          feedbackUnreadCount={feedbackUnreadCount}
        />
        {adminUser ? (
          <div className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Platform metrics</h2>
            <p className="text-sm text-[#8b98a5]">
              Totals from <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">admin_dashboard_metrics</code>{" "}
              (deposits, entry fees, payouts from ledgers).
            </p>
            <AdminDashboardMetricsPanel />
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-[#2a3039] bg-[#141920]/40 px-6 py-12 text-center">
            <p className="text-sm text-[#8b98a5]">Admin metrics require full admin access.</p>
          </div>
        )}
      </div>
    </div>
  );
}
