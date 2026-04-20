"use client";

import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";

export default function DashboardFeedbackPage() {
  const router = useRouter();
  return (
    <DashboardShell
      title="Help Improve CashCaddies"
      description="Report a bug or suggest an idea — your feedback shapes what we build next."
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
        <p className="text-sm text-slate-400">What would you like to share?</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/feedback/bug")}
            className="group flex flex-col items-start rounded-xl border border-red-800/60 bg-red-950/25 px-5 py-6 text-left shadow-sm transition hover:border-red-600/70 hover:bg-red-950/40 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-red-300/90">Report</span>
            <span className="mt-1 text-lg font-bold text-red-100">Report Bug</span>
            <span className="mt-2 text-sm text-red-200/80">
              Something broke, looks wrong, or blocked you — tell us what happened.
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/feedback/idea")}
            className="group flex flex-col items-start rounded-xl border border-emerald-700/50 bg-emerald-950/20 px-5 py-6 text-left shadow-sm transition hover:border-emerald-500/60 hover:bg-emerald-950/35 focus:outline-none focus:ring-2 focus:ring-emerald-500/45"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">Suggest</span>
            <span className="mt-1 text-lg font-bold text-emerald-100">Suggest Idea</span>
            <span className="mt-2 text-sm text-emerald-200/85">
              A feature, improvement, or change that would make CashCaddies better.
            </span>
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
