"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  hasAccess: boolean;
  children: ReactNode;
  /** Extra classes on the outer wrapper (access granted or locked). */
  className?: string;
  upgradeHref?: string;
  /** When null, the secondary button is hidden. */
  betaHref?: string | null;
};

/** Blurs children and shows a centered upsell card when the viewer lacks premium / DFS beta access. */
export function PremiumGate({
  hasAccess,
  children,
  className = "",
  upgradeHref = "/premium",
  betaHref = "/dashboard/beta-users",
}: Props) {
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative min-h-[8rem] ${className}`.trim()}>
      <div
        className="pointer-events-none select-none blur-[4px]"
        aria-hidden="true"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-xl border border-amber-600/35 bg-[#0c1015] px-5 py-6 text-center shadow-xl shadow-black/50">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/50 bg-amber-950/40 text-2xl text-amber-300">
            <span aria-hidden="true">🔒</span>
          </div>
          <h3 className="text-base font-bold text-white">Premium Feature</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#9fb0bf]">
            Advanced DFS tools available with Premium membership. Upgrade to unlock tee waves, ownership, and wave
            analytics.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={upgradeHref}
              className="inline-flex items-center justify-center rounded-lg border border-amber-500/70 bg-gradient-to-b from-amber-500/90 to-amber-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 shadow-sm hover:from-amber-400 hover:to-amber-500"
            >
              Upgrade to unlock
            </Link>
            {betaHref ? (
              <Link
                href={betaHref}
                className="inline-flex items-center justify-center rounded-lg border border-[#3d4550] bg-[#1c2128] px-4 py-2.5 text-sm font-semibold text-[#c5cdd5] hover:border-[#4a5563] hover:bg-[#232a33]"
              >
                Become Beta Tester
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
