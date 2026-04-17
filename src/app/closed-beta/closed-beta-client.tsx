"use client";

import Link from "next/link";
import { ClosedBetaStats } from "@/components/closed-beta-stats";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";
import { isAdmin } from "@/lib/permissions";
import { useWallet } from "@/hooks/use-wallet";

const FEATURES = [
  {
    icon: "🛡",
    title: "CashCaddies Safety Coverage",
    description: "Protect one golfer per lineup",
  },
  {
    icon: "🏦",
    title: "Community Protection Fund",
    description: "Player funded protection pool",
  },
  {
    icon: "🧭",
    title: "Founder Access",
    description: "Direct feedback to product team",
  },
  {
    icon: "🎁",
    title: "Early Beta Perks",
    description: "Founding user benefits",
  },
];

export function ClosedBetaClient() {
  const { user, wallet, fullUser, loading } = useWallet();

  const hasAppAccess = hasClosedBetaAppAccess(
    { beta_user: wallet?.beta_user, beta_status: wallet?.beta_status },
    fullUser?.role,
  );
  const isPending = Boolean(user) && !loading && !hasAppAccess;
  const isStaff = isAdmin(fullUser?.role);

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/95 p-8 shadow-xl shadow-black/30">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Invite Program</p>
      <h1 className="mt-3 text-center text-3xl font-bold text-white sm:text-4xl">CashCaddies Closed Beta - Invite Only</h1>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-300">
        CashCaddies is currently accepting a limited number of serious fantasy golf players while we refine the platform.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {FEATURES.map((item) => (
          <div key={item.title} className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
            <p className="text-sm font-semibold text-white">
              <span className="mr-2" aria-hidden="true">
                {item.icon}
              </span>
              {item.title}
            </p>
            <p className="mt-1 text-xs text-slate-400">{item.description}</p>
          </div>
        ))}
      </div>

      <ClosedBetaStats />

      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-4 text-center">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading account…</div>
        ) : null}

        {!loading && !user ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/early-access"
              className="inline-flex items-center justify-center rounded border border-sky-600/50 bg-sky-900/40 px-6 py-3 text-sm font-bold uppercase tracking-wide text-sky-100 hover:bg-sky-900/60"
            >
              Early access signup
            </Link>
            <Link
              href="mailto:contact@cashcaddies.com?subject=CashCaddies%20Beta%20Access%20Request"
              className="inline-flex items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
            >
              Email request
            </Link>
          </div>
        ) : null}

        {!loading && isPending ? (
          <div className="space-y-2">
            <p className="inline-flex rounded border border-amber-500/40 bg-amber-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-100">
              Beta Status: Pending Approval
            </p>
            <p className="text-sm text-slate-300">You are on the waitlist. Access is reviewed manually.</p>
          </div>
        ) : null}

        {!loading && isStaff ? (
          <div className="space-y-3">
            <p className="inline-flex rounded border border-emerald-500/40 bg-emerald-950/30 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
              Staff: you can review beta requests
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/dashboard/admin/beta-queue"
                className="inline-flex items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-5 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
              >
                Open beta queue
              </Link>
              <Link
                href="/dashboard/admin/waitlist"
                className="inline-flex items-center justify-center rounded border border-sky-600/50 bg-sky-900/50 px-5 py-2 text-xs font-bold uppercase tracking-wide text-sky-100 hover:bg-sky-900/70"
              >
                Waitlist manager
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
