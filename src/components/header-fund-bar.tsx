"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Centered premium header message (replaces the prior rotating fund ticker in this slot).
 * Static copy with a clear signup affordance — no rotation or live fund fetches here.
 */
export function HeaderRotatingStatus() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="statusBar mx-auto mt-1 w-full max-w-[min(96vw,40rem)] rounded-lg px-3 py-2 sm:px-4 sm:py-2.5"
      title="Create an account to join the waitlist for beta approval."
    >
      <p className="statusText mx-auto max-w-[38rem] text-center text-[11px] leading-snug tracking-wide text-yellow-100/95 sm:text-xs sm:leading-relaxed">
        <Link
          href="/signup"
          className="font-semibold text-amber-200 underline decoration-amber-400/40 underline-offset-2 transition-colors hover:text-amber-100 hover:decoration-amber-300/60"
        >
          Create Account now
        </Link>
        <span className="text-yellow-100/90"> and join waitlist to be beta approved</span>
      </p>
    </div>
  );
}
