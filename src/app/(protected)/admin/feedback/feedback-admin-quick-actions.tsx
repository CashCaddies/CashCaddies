"use client";

import { useTransition } from "react";
import { bulkUpdateFeedbackAdminStatus } from "@/app/(protected)/admin/feedback/actions";
import type { AdminFeedbackStatus } from "@/app/(protected)/admin/feedback/feedback-admin-types";

const BULK_STATUSES: { status: Exclude<AdminFeedbackStatus, "new">; label: string }[] = [
  { status: "reviewed", label: "Mark Reviewed" },
  { status: "planned", label: "Mark Planned" },
  { status: "fixed", label: "Mark Fixed" },
];

function notifyFeedbackUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-feedback-updated"));
  }
}

export function FeedbackAdminQuickActions({ feedbackIds }: { feedbackIds: string[] }) {
  const [pending, startTransition] = useTransition();

  if (feedbackIds.length === 0) {
    return null;
  }

  function mark(status: Exclude<AdminFeedbackStatus, "new">) {
    startTransition(async () => {
      const result = await bulkUpdateFeedbackAdminStatus(feedbackIds, status);
      if (result.ok) {
        notifyFeedbackUpdated();
      }
    });
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 border-b border-[#2a3039] pb-4"
      role="toolbar"
      aria-label="Bulk status actions for listed new feedback"
    >
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-[#8b98a5]">Quick</span>
      {BULK_STATUSES.map(({ status, label }) => (
        <button
          key={status}
          type="button"
          disabled={pending}
          onClick={() => mark(status)}
          className="rounded-md border border-[#2a3039] bg-[#141920] px-3 py-1.5 text-sm font-medium text-[#c5cdd5] transition hover:border-slate-600 hover:bg-[#1a222c] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
