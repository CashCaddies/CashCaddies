"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { isAdmin as userHasAdminRole } from "@/lib/permissions";

type LobbyEmptyStateProps = {
  viewerIsAdmin?: boolean;
};

export function LobbyEmptyState({ viewerIsAdmin }: LobbyEmptyStateProps = {}) {
  const { wallet, fullUser, loading } = useWallet();
  const fromWallet = !loading && userHasAdminRole(fullUser?.role);
  const showAdmin = viewerIsAdmin === true || (viewerIsAdmin === undefined && fromWallet);

  return (
    <div className="px-5 py-10 text-center text-[#8b98a5]">
      <p>No contests available.</p>
      {showAdmin ? (
        <div className="mt-3">
          <Link
            href="/admin/create-contest"
            className="inline-flex items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
          >
            Create First Contest
          </Link>
        </div>
      ) : null}
    </div>
  );
}

