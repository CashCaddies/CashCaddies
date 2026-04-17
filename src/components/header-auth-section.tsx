"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import UserMenu from "@/components/UserMenu";
import { hasActivePaidPremium } from "@/lib/access-control";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";

/** Header beta gate uses `profiles.role` (via `hasClosedBetaAppAccess`); do not use `profiles.admin_user` in UI. */

const loginButtonClass = "ccButton text-base";

type RenderProps = {
  showMinimalHeader: boolean;
  authControls: ReactNode;
  /** Amber “Premium” link when user has active paid/admin premium. */
  premiumHeaderTag: ReactNode | null;
};

type Props = {
  render: (ctx: RenderProps) => ReactNode;
};

export function HeaderAuthSection({ render }: Props) {
  const { user, isReady } = useAuth();
  const { wallet, fullUser, loading: walletLoading } = useWallet();

  const deciding = !isReady;
  const hasBetaAccess =
    Boolean(user) &&
    hasClosedBetaAppAccess(
      { beta_user: wallet?.beta_user, beta_status: fullUser?.beta_status ?? wallet?.beta_status },
      fullUser?.role,
    );
  const showMinimalHeader = deciding || !hasBetaAccess;

  const handle =
    typeof wallet?.username === "string" && wallet.username.trim() !== "" ? wallet.username.trim() : null;
  const label = handle != null ? `@${handle}` : "Account";

  const paidPremiumActive =
    Boolean(wallet) &&
    hasActivePaidPremium({
      is_premium: wallet?.is_premium,
      premium_expires_at: wallet?.premium_expires_at ?? null,
    });

  const premiumHeaderTag: ReactNode =
    !deciding && user && hasBetaAccess && paidPremiumActive ? (
      <Link
        href="/premium"
        className="hidden shrink-0 items-center gap-1 rounded-full border border-amber-500/45 bg-amber-950/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100 hover:border-amber-400/60 sm:inline-flex"
        title="CashCaddies Premium"
      >
        <span aria-hidden="true">👑</span>
        Premium
      </Link>
    ) : null;

  /**
   * Pass header menu profile whenever auth + fullUser exist.
   * Do not require `wallet` to be non-null — `fullUser` is always derived from the latest wallet row
   * once loading finishes; gating is handled by `deciding` + wallet fetch.
   */
  const menuProfile =
    user && fullUser
      ? {
          avatar_url: wallet?.avatar_url ?? null,
          role: fullUser.role,
          beta_status: fullUser.beta_status ?? wallet?.beta_status ?? null,
          username: typeof wallet?.username === "string" && wallet.username.trim() !== "" ? wallet.username : null,
          founding_tester: wallet?.founding_tester === true,
        }
      : null;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !menuProfile) return;
    console.log("PROFILE:", menuProfile, "ROLE:", menuProfile.role);
  }, [menuProfile]);

  let authControls: React.ReactNode;
  if (deciding) {
    authControls = <div className="h-10 w-24 shrink-0 animate-pulse rounded-md bg-slate-800/80" aria-hidden />;
  } else if (!user) {
    authControls = (
      <Link href="/login" className={loginButtonClass}>
        Login
      </Link>
    );
  } else if (walletLoading) {
    authControls = <UserMenu profile={menuProfile} label={label} premiumSubscriber={paidPremiumActive} />;
  } else if (!hasBetaAccess) {
    authControls = <UserMenu profile={menuProfile} label={label} locked />;
  } else {
    authControls = <UserMenu profile={menuProfile} label={label} premiumSubscriber={paidPremiumActive} />;
  }

  return render({ showMinimalHeader, authControls, premiumHeaderTag });
}
