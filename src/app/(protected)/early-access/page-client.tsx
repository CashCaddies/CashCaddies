"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitEarlyAccessSignup } from "./actions";

export default function EarlyAccessPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await submitEarlyAccessSignup(email, username);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMessage("You are on the list. We will email you when access opens.");
        setEmail("");
        setUsername("");
      })();
    });
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-lg px-4 py-16">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prelaunch</p>
      <h1 className="mt-3 text-center text-3xl font-bold text-white sm:text-4xl">Early access</h1>
      <p className="mx-auto mt-3 text-center text-sm text-slate-300">
        Request a spot for the CashCaddies closed beta. Tell us your email and the handle you would like to use.
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
        <div>
          <label htmlFor="ea-email" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Email
          </label>
          <input
            id="ea-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="ea-username" className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Desired username
          </label>
          <input
            id="ea-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            placeholder="your_handle"
          />
          <p className="mt-1 text-xs text-slate-500">3–20 characters: letters, numbers, underscores. Cannot start with user_.</p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl border border-emerald-600/50 bg-emerald-950/50 py-3 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-950/70 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Request early access"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/dashboard" className="text-emerald-400/90 underline-offset-2 hover:text-emerald-300 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
