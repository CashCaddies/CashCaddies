"use client";

import Link from "next/link";
import { isPlaceholderUsername } from "@/lib/username";
import { useWallet } from "@/hooks/use-wallet";

/** Inline reminder when gate is not shown (e.g. loading) or on profile after scroll. */
export function DashboardHandleOnboardingBanner() {
  const { user, wallet, loading } = useWallet();

  if (loading || !user || !wallet?.username) {
    return null;
  }

  if (!isPlaceholderUsername(wallet.username)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-600/40 bg-amber-950/50 px-4 py-3 text-sm text-amber-100">
      <p className="font-semibold text-amber-50">Choose your DFS handle to continue</p>
      <p className="mt-2">
        <Link
          href="/dashboard/profile"
          className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Go to /dashboard/profile
        </Link>
      </p>
    </div>
  );
}
