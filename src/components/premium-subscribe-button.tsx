"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { createPremiumCheckoutSession } from "@/app/premium/actions";

type Props = {
  /** When true, user already has an active paid premium grant. */
  subscribed: boolean;
  /** Shown on the CTA (from server, e.g. NEXT_PUBLIC_PREMIUM_PRICE_LABEL). */
  priceLabel: string;
};

export function PremiumSubscribeButton({ subscribed, priceLabel }: Props) {
  const { user, isReady } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = priceLabel;

  if (!isReady) {
    return (
      <div className="h-12 w-full max-w-xs animate-pulse rounded-lg bg-slate-800/80" aria-hidden="true" />
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Sign in with your CashCaddies account to subscribe.</p>
        <Link
          href="/login"
          className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-500/90 to-amber-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 shadow-sm hover:from-amber-400 hover:to-amber-500"
        >
          Log in to upgrade
        </Link>
      </div>
    );
  }

  if (subscribed) {
    return (
      <p className="text-sm font-medium text-emerald-300/95">
        You have an active Premium membership. Advanced DFS tools are unlocked across contests.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            void (async () => {
              const r = await createPremiumCheckoutSession();
              if (!r.ok) {
                setError(r.error);
                return;
              }
              window.location.href = r.url;
            })();
          });
        }}
        className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-500/90 to-amber-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-slate-950 shadow-sm hover:from-amber-400 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Redirecting…" : `Upgrade to Premium — ${label}`}
      </button>
      {error ? (
        <p className="max-w-md text-sm text-red-300/95" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
