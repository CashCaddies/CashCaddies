"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPlaceholderUsername } from "@/lib/username";
import { useWallet } from "@/hooks/use-wallet";

/**
 * Blocks dashboard usage until the user replaces a `user_…` placeholder with a real DFS handle.
 * Profile route stays usable so they can submit the form.
 */
export function DashboardHandleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, wallet, loading } = useWallet();

  const onProfile =
    pathname === "/dashboard/profile" || pathname?.startsWith("/dashboard/profile/");
  const onBetaManagement =
    pathname === "/dashboard/beta-management" || pathname?.startsWith("/dashboard/beta-management/");

  if (loading || !user || !wallet?.username) {
    return <>{children}</>;
  }

  if (!isPlaceholderUsername(wallet.username) || onProfile || onBetaManagement) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-[40vh]">
      <div className="pointer-events-auto relative z-0 select-none opacity-[0.12] blur-[1px]" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 z-40 flex items-start justify-center pt-8 sm:pt-12">
        <div
          className="pointer-events-auto mx-4 w-full max-w-lg rounded-xl border border-amber-500/50 bg-slate-950/95 p-6 shadow-xl shadow-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dfs-handle-gate-title"
        >
          <h2 id="dfs-handle-gate-title" className="text-lg font-bold text-amber-50">
            Choose your DFS handle to continue
          </h2>
          <p className="mt-2 text-sm text-amber-100/90">
            Your account still uses a temporary name (<span className="font-mono text-white">@{wallet.username}</span>
            ). Pick a unique handle to use contests and leaderboards.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/profile"
              className="inline-flex rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Go to /dashboard/profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
