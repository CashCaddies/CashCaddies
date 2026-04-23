"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export const JOIN_WAITLIST_PENDING_MESSAGE = "Your access request is already pending review.";

type Props = {
  /** `compact` for tight spaces (e.g. account menu); `card` for full pages. */
  variant?: "card" | "compact";
  /** When true, hide the submit CTA (e.g. user is already in a pending-approval state). */
  hasPendingRequest?: boolean;
};

export function JoinWaitlistFlow({ variant = "card", hasPendingRequest = false }: Props) {
  const { user, isReady } = useAuth();
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  const submit = useCallback(async () => {
    if (!user) return;
    setPhase("loading");
    setErrorText("");
    try {
      const res = await fetch("/api/waitlist-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() ? message.trim() : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setPhase("success");
        return;
      }
      const raw = typeof data.error === "string" ? data.error : "Something went wrong.";
      if (res.status === 409 || raw.toLowerCase().includes("already pending")) {
        setErrorText("You already have a pending access request.");
      } else {
        setErrorText(raw);
      }
      setPhase("error");
    } catch {
      setErrorText("Network error. Try again.");
      setPhase("error");
    }
  }, [message, user]);

  const isCompact = variant === "compact";
  const boxClass = isCompact
    ? "rounded-lg border border-white/10 bg-black/30 px-3 py-3"
    : "rounded-xl border border-emerald-500/20 bg-slate-950/60 p-5 shadow-inner shadow-black/30";

  if (!isReady) {
    return <p className={`text-slate-500 ${isCompact ? "text-xs" : "text-sm"}`}>Checking session…</p>;
  }

  if (!user) {
    return (
      <div className={boxClass}>
        <p className={`font-medium text-slate-200 ${isCompact ? "text-xs leading-snug" : "text-sm"}`}>
          Log in or create an account to join the waitlist.
        </p>
        <div className={`mt-3 flex flex-wrap gap-2 ${isCompact ? "" : "gap-3"}`}>
          <Link
            href="/login"
            className={`inline-flex rounded-md border border-emerald-500/40 bg-emerald-950/40 font-semibold text-emerald-100 transition hover:bg-emerald-950/60 ${isCompact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={`inline-flex rounded-md border border-slate-600 bg-slate-900/80 font-semibold text-slate-200 transition hover:border-slate-500 ${isCompact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"}`}
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (hasPendingRequest) {
    return (
      <div className={boxClass}>
        <p className={`font-medium text-slate-300 ${isCompact ? "text-xs leading-relaxed" : "text-sm leading-relaxed"}`}>
          {JOIN_WAITLIST_PENDING_MESSAGE}
        </p>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className={boxClass}>
        <p className={`font-semibold text-emerald-300 ${isCompact ? "text-xs" : "text-sm"}`}>Request submitted</p>
        <p className={`mt-1 text-slate-400 ${isCompact ? "text-[11px] leading-snug" : "text-xs"}`}>
          We&apos;ll review your access request soon.
        </p>
      </div>
    );
  }

  return (
    <div className={boxClass} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <p className={`text-slate-300 ${isCompact ? "text-[11px] leading-snug" : "text-sm"}`}>
        Submit a request for beta access. Staff are notified automatically.
      </p>
      {!isCompact ? (
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional note</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Anything we should know?"
            className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
      ) : (
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional note…"
          className="mt-2 w-full resize-none rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none"
        />
      )}
      {phase === "error" && errorText ? (
        <p className={`mt-2 text-amber-200/95 ${isCompact ? "text-[11px]" : "text-xs"}`} role="alert">
          {errorText}
        </p>
      ) : null}
      <button
        type="button"
        disabled={phase === "loading"}
        onClick={() => void submit()}
        className={`mt-3 w-full rounded-lg border border-emerald-500/50 bg-emerald-600/20 font-bold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-600/30 disabled:opacity-50 ${isCompact ? "py-2 text-xs" : "py-2.5 text-sm"}`}
      >
        {phase === "loading" ? "Submitting…" : "Join Waitlist"}
      </button>
    </div>
  );
}
