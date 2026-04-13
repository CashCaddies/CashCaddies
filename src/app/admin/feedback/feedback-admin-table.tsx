"use client";

import { useTransition } from "react";
import { updateBetaFeedbackAdminStatus } from "@/app/admin/feedback/actions";
import {
  ADMIN_FEEDBACK_STATUSES,
  type AdminFeedbackStatus,
  type BetaFeedbackAdminRow,
} from "@/app/admin/feedback/feedback-admin-types";

const STATUS_STYLE: Record<AdminFeedbackStatus, string> = {
  new: "bg-amber-500/15 text-amber-100 ring-amber-500/40",
  reviewed: "bg-sky-500/15 text-sky-100 ring-sky-500/40",
  planned: "bg-violet-500/15 text-violet-100 ring-violet-500/40",
  fixed: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/40",
};

const STATUS_LABEL: Record<AdminFeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  planned: "Planned",
  fixed: "Fixed",
};

function typeTag(row: BetaFeedbackAdminRow) {
  const ft = row.feedback_type?.toLowerCase();
  if (ft === "bug") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-red-950/70 text-red-200 ring-1 ring-red-800/55">
        Bug
      </span>
    );
  }
  if (ft === "idea") {
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-xs font-semibold bg-emerald-950/70 text-emerald-200 ring-1 ring-emerald-700/45">
        Idea
      </span>
    );
  }
  return <span className="text-[#6b7684]">—</span>;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function notifyFeedbackUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-feedback-updated"));
  }
}

export function FeedbackAdminTable({ rows }: { rows: BetaFeedbackAdminRow[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm text-[#c5cdd5]">
        <thead>
          <tr className="border-b border-[#2a3039] text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
            <th className="px-3 py-3">Handle</th>
            <th className="px-3 py-3">Email</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Title</th>
            <th className="px-3 py-3">Message</th>
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const current = row.status as AdminFeedbackStatus;
            const safeStatus = ADMIN_FEEDBACK_STATUSES.includes(current) ? current : "new";
            return (
              <tr key={row.id} className="border-b border-[#2a3039]/80 align-top hover:bg-[#141920]/50">
                <td className="max-w-[120px] px-3 py-3 font-medium text-white">
                  {row.username?.trim() ? row.username.trim() : "—"}
                </td>
                <td className="max-w-[180px] break-all px-3 py-3 text-[#9aa5b1]">
                  {row.email?.trim() ? row.email.trim() : "—"}
                </td>
                <td className="px-3 py-3">{typeTag(row)}</td>
                <td className="max-w-[160px] px-3 py-3 text-[#e8ecf0]">
                  {row.title?.trim() ? row.title.trim() : "—"}
                </td>
                <td className="max-w-md px-3 py-3">
                  <p className="whitespace-pre-wrap break-words text-[#9aa5b1]">
                    {row.message?.trim() ? row.message.trim() : "—"}
                  </p>
                  {row.issue_page?.trim() ? (
                    <p className="mt-2 text-xs text-[#6b7684]">
                      Page: <span className="text-[#9aa5b1]">{row.issue_page.trim()}</span>
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[#9aa5b1]">{formatDate(row.created_at)}</td>
                <td className="px-3 py-3">
                  <div className="relative z-0">
                    <select
                      className={`w-full min-w-[140px] relative z-0 rounded-md border bg-[#0f1419] px-2 py-1.5 text-sm font-medium text-white ring-1 focus:outline-none focus:ring-2 disabled:opacity-50 ${STATUS_STYLE[safeStatus]}`}
                      value={safeStatus}
                      disabled={pending}
                      aria-label={`Status for feedback ${row.id}`}
                      onChange={(e) => {
                        const next = e.target.value as AdminFeedbackStatus;
                        startTransition(async () => {
                          const r = await updateBetaFeedbackAdminStatus(row.id, next);
                          if (r.ok) notifyFeedbackUpdated();
                        });
                      }}
                    >
                      {ADMIN_FEEDBACK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
