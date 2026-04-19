import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedbackAdminQuickActions } from "@/app/admin/feedback/feedback-admin-quick-actions";
import { FeedbackAdminTable } from "@/app/admin/feedback/feedback-admin-table";
import { getAdminNewFeedbackCount, listBetaFeedbackAdmin } from "@/app/admin/feedback/actions";
import type { BetaFeedbackAdminRow } from "@/app/admin/feedback/feedback-admin-types";
import { AdminHubNav } from "@/components/admin-hub-nav";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  const { userId } = await requireAdmin();

  const admin = createServiceRoleClient();
  const { data: profile } = admin
    ? await admin.from("profiles").select("founding_tester, role").eq("id", userId).maybeSingle()
    : { data: null };

  if (!profile) {
    redirect("/login");
  }

  const sp = searchParams ? await searchParams : {};
  /** Default: New Feedback first (only explicit ?filter=all shows all). */
  const listFilter = sp?.filter === "all" ? "all" : "new";

  const [result, unreadResult] = await Promise.all([
    listBetaFeedbackAdmin(listFilter),
    getAdminNewFeedbackCount(),
  ]);
  let rows: BetaFeedbackAdminRow[] = [];
  let loadError: string | null = null;

  if (!result.ok) {
    loadError = result.error;
  } else {
    rows = result.rows;
  }

  const feedbackUnreadCount = unreadResult.ok ? unreadResult.count : undefined;

  const foundingTester = profile?.founding_tester === true;
  const adminUser = true;

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Feedback Inbox</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          <span className="text-[#c5cdd5]">New Feedback</span> loads first; switch to{" "}
          <span className="text-[#c5cdd5]">All Feedback</span> for the full list.{" "}
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
          .
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        <AdminHubNav
          section="feedback"
          foundingTester={foundingTester}
          adminUser={adminUser}
          feedbackSub={listFilter === "new" ? "new" : "all"}
          feedbackUnreadCount={feedbackUnreadCount}
        />

        {loadError && (
          <p className="mb-4 mt-6 rounded border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {loadError}
            {loadError.includes("admin_user_list_beta_feedback") || loadError.includes("function") ? (
              <>
                {" "}
                Apply migration <code className="rounded bg-black/30 px-1">077_beta_feedback_message_status.sql</code>{" "}
                and ensure <code className="rounded bg-black/30 px-1">role</code> is admin or senior_admin.
              </>
            ) : null}
          </p>
        )}

        {!loadError ? (
          <>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
              {listFilter === "new" ? "New Feedback" : "All Feedback"}
            </h2>

            {listFilter === "new" && rows.length > 0 ? (
              <FeedbackAdminQuickActions feedbackIds={rows.map((r) => r.id)} />
            ) : null}

            {rows.length === 0 ? (
              <div className="mt-10 space-y-2 text-center" role="status">
                {listFilter === "new" ? (
                  <>
                    <p className="text-sm text-[#8b98a5]">No new feedback right now.</p>
                    <p className="text-xs text-[#6b7684]">Mark items as reviewed or switch to All Feedback.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#8b98a5]">No feedback submitted yet</p>
                    <p className="text-xs text-[#6b7684]">Beta feedback will appear here.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <FeedbackAdminTable rows={rows} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
