"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { isAdmin as userHasAdminRole } from "@/lib/permissions";

type LobbyAdminActionsProps = {
  /** When set (e.g. from lobby profile load), skips wallet timing issues */
  viewerIsAdmin?: boolean;
};

export function LobbyAdminActions({ viewerIsAdmin }: LobbyAdminActionsProps = {}) {
  const { wallet, fullUser, loading } = useWallet();
  const fromWallet = !loading && userHasAdminRole(fullUser?.role);
  const showAdmin = viewerIsAdmin === true || (viewerIsAdmin === undefined && fromWallet);
  if (!showAdmin) return null;

  return (
    <Link
      href="/admin/create-contest"
      className="inline-flex items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-5 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
    >
      Create Contest
    </Link>
  );
}

