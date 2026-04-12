"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminHubSection = "beta-users" | "feedback" | "stats";

export type AdminHubNavMode = "dashboard" | "single";

type Props = {
  section: AdminHubSection;
  foundingTester: boolean;
  adminUser: boolean;
  /** Sub-navigation on Feedback: all vs new (default in app is new-first). */
  feedbackSub?: "all" | "new";
  /**
   * When set (≥0), main nav shows "Feedback Inbox (n)" for unread/new feedback.
   * Omit or pass `undefined` if the count could not be loaded.
   */
  feedbackUnreadCount?: number;
  /**
   * `dashboard` = Beta Users, Feedback Inbox, Stats (when applicable).
   * `single` = only the tab for the current `section`.
   */
  navMode?: AdminHubNavMode;
};

function linkClass(active: boolean) {
  return `rounded-md px-3 py-2 text-sm font-semibold transition ${
    active ? "bg-slate-700/80 text-white ring-1 ring-slate-500/40" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
  }`;
}

export function AdminHubNav({
  section,
  foundingTester,
  adminUser,
  feedbackSub = "new",
  feedbackUnreadCount,
  navMode = "single",
}: Props) {
  const pathname = usePathname();
  if (!foundingTester && !adminUser) {
    return null;
  }

  const feedbackInboxLabel =
    typeof feedbackUnreadCount === "number" && feedbackUnreadCount >= 0
      ? `Feedback Inbox (${feedbackUnreadCount})`
      : "Feedback Inbox";

  const showBetaLink = foundingTester && (navMode === "dashboard" || section === "beta-users");
  const showFeedbackLink = adminUser && (navMode === "dashboard" || section === "feedback");
  const showStatsLink =
    (foundingTester || adminUser) && (navMode === "dashboard" || section === "stats");

  return (
    <div className="mb-6 space-y-3 border-b border-slate-800 pb-4">
      <nav className="flex flex-wrap gap-2" aria-label="Admin sections">
        {showBetaLink ? (
          <Link
            href="/dashboard/beta-management"
            className={linkClass(section === "beta-users" || pathname?.startsWith("/dashboard/beta-management"))}
          >
            Beta Users
          </Link>
        ) : null}
        {showFeedbackLink ? (
          <Link
            href="/admin/feedback"
            className={linkClass(section === "feedback" || pathname?.startsWith("/admin/feedback"))}
          >
            {feedbackInboxLabel}
          </Link>
        ) : null}
        {showStatsLink ? (
          <Link
            href="/admin/stats"
            className={linkClass(section === "stats" || pathname?.startsWith("/admin/stats"))}
          >
            Stats
          </Link>
        ) : null}
        {adminUser ? (
          <Link
            href="/admin/payout-history"
            className={linkClass(pathname?.startsWith("/admin/payout-history") ?? false)}
          >
            View Payouts
          </Link>
        ) : null}
      </nav>

      {section === "feedback" && adminUser ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Feedback sections">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">View</span>
          <Link
            href="/admin/feedback?filter=all"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              feedbackSub === "all" ? "bg-emerald-600/20 text-emerald-200 ring-1 ring-emerald-500/35" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            All Feedback
          </Link>
          <Link
            href="/admin/feedback"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              feedbackSub === "new" ? "bg-amber-500/20 text-amber-100 ring-1 ring-amber-500/40" : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            New Feedback
          </Link>
        </div>
      ) : null}
    </div>
  );
}
