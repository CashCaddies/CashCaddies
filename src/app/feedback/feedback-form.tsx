"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import type { FeedbackIntakeType } from "@/app/feedback/actions";
import { supabase } from "@/lib/supabase";

type Flow = "choose" | FeedbackIntakeType;

export function FeedbackForm({
  forcedFlow,
}: {
  forcedFlow?: FeedbackIntakeType;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>(forcedFlow ?? "choose");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [issuePage, setIssuePage] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!success) return;
    const id = window.setTimeout(() => {
      setSuccess(false);
    }, 4000);
    return () => window.clearTimeout(id);
  }, [success]);

  const isBug = flow === "bug";
  const routeLocked = forcedFlow === "bug" || forcedFlow === "idea";

  function resetForm() {
    setTitle("");
    setMessage("");
    setIssuePage("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (flow === "choose") return;
    startTransition(async () => {
      if (!supabase) {
        setError("Supabase client is not available.");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Loading...");
        return;
      }

      const { error: insertError } = await supabase.from("beta_feedback").insert({
        user_id: user.id,
        feedback_type: flow,
        title: title.trim(),
        message: message.trim(),
        issue_page: issuePage.trim() || null,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
      resetForm();
      if (!routeLocked) {
        setFlow("choose");
      }
      setSuccess(true);
    });
  }

  return (
    <DashboardShell
      title="Help Improve CashCaddies"
      description="Report a bug or suggest an idea — your feedback shapes what we build next."
    >
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
        {success ? (
          <div
            className="mt-4 flex gap-3 rounded-xl border border-emerald-700/40 bg-emerald-900/20 p-4 text-emerald-300"
            role="status"
            aria-live="polite"
          >
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            </svg>
            <p className="min-w-0 text-sm leading-relaxed sm:text-base">
              Thank you! Your feedback helps shape CashCaddies.
            </p>
          </div>
        ) : flow === "choose" ? (
          <div className="space-y-6">
            <p className="text-sm text-slate-400">What would you like to share?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setFlow("bug");
                  resetForm();
                }}
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
                onClick={() => {
                  setFlow("idea");
                  resetForm();
                }}
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
        ) : (
          <>
            {error ? (
              <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (routeLocked) {
                    router.push("/dashboard/feedback");
                    return;
                  }
                  setFlow("choose");
                  resetForm();
                }}
                className="text-sm font-semibold text-slate-400 underline hover:text-slate-200"
              >
                ← Back
              </button>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isBug ? "bg-red-950/60 text-red-200 ring-1 ring-red-700/50" : "bg-emerald-950/60 text-emerald-200 ring-1 ring-emerald-600/45"
                }`}
              >
                {isBug ? "Bug" : "Idea"}
              </span>
            </div>

            <form className="space-y-6" onSubmit={onSubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">Title</span>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder={isBug ? "Short summary of the issue" : "Short summary of your idea"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  required
                  autoComplete="off"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">Description</span>
                <textarea
                  className="min-h-[140px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder={
                    isBug
                      ? "What happened? What did you expect?"
                      : "Describe the idea and why it matters."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">
                  {isBug ? "Page where issue occurred (optional)" : "Page or area (optional)"}
                </span>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="e.g. /lobby, contest screen, or URL"
                  value={issuePage}
                  onChange={(e) => setIssuePage(e.target.value)}
                  maxLength={500}
                  autoComplete="off"
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className={`rounded-md px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  isBug
                    ? "bg-red-700 text-white hover:bg-red-600"
                    : "bg-emerald-600 text-slate-950 hover:bg-emerald-500"
                }`}
              >
                {isPending ? "Submitting…" : isBug ? "Submit bug report" : "Submit idea"}
              </button>
            </form>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
