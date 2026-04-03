"use client";

import { BetaAccessBadge } from "@/components/beta-access-badge";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";

/** Full-width closed-beta strip — only when the user does not have beta (or admin) access. */
export function ConditionalBetaBanner() {
  const { user, isReady } = useAuth();
  const { wallet, fullUser, loading } = useWallet();
  if (!isReady || (user != null && loading)) {
    return null;
  }
  const hasAccess = Boolean(user) && hasClosedBetaAppAccess(wallet, fullUser?.role);
  if (hasAccess) {
    return null;
  }
  return <BetaAccessBadge />;
}
