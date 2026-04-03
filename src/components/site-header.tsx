"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderAuthSection } from "@/components/header-auth-section";
import { HeaderFundBar } from "@/components/header-fund-bar";
import { HeaderLogoLink } from "@/components/header-logo-link";
import { HeaderStats } from "@/components/header-stats";

const navColors = [
  "text-yellow-400 hover:text-yellow-300",
  "text-emerald-400 hover:text-emerald-300",
];

const navItems = [
  { href: "/lobby", label: "Lobby" },
  { href: "/dashboard/contests", label: "Contests" },
  { href: "/dashboard/lineups", label: "Lineups" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (logo → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const brandLinks = (
    <div className="headerLinks hidden md:flex">
      <div className="headerCol">
        <Link href="/faq">FAQ</Link>
        <Link href="/terms">Terms</Link>
      </div>
      <div className="headerCol">
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
    </div>
  );

  const ccMainNav = (
    <nav
      className="ccMainNav flex min-h-0 min-w-0 flex-1 items-center justify-center gap-8 overflow-x-auto whitespace-nowrap"
      aria-label="Primary"
    >
      {navItems.map((item, index) => {
        const colorClass = navColors[index % navColors.length];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${colorClass} font-semibold transition-colors duration-200`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const headerRight = (authControls: ReactNode, premiumTag: ReactNode | null) => (
    <div className="headerRight flex shrink-0 items-center justify-end gap-4">
      {premiumTag}
      <HeaderStats />
      {authControls}
    </div>
  );

  return (
    <header className="w-full overflow-visible border-b border-yellow-500/20 bg-gradient-to-b from-slate-950 to-slate-900">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full min-w-0 max-w-7xl items-center px-6 py-4">
              <div className="headerLeft flex shrink-0 items-center gap-6">
                {ctx.showMinimalHeader ? (
                  <HeaderLogoLink href="/closed-beta" variant="minimal">
                    <div className="brandText hidden min-w-0 flex-col leading-tight md:flex">
                      <h1 className="brandTitle brandTitle--compact">CashCaddies</h1>
                      <p className="brandSubtitle">Daily Fantasy Golf Platform</p>
                      {brandLinks}
                    </div>
                  </HeaderLogoLink>
                ) : (
                  <HeaderLogoLink href="/closed-beta" variant="full">
                    <div className="brandText hidden min-w-0 flex-col leading-tight md:flex">
                      <h1 className="brandTitle">CashCaddies</h1>
                      <p className="brandSubtitle">Daily Fantasy Golf Platform</p>
                      {brandLinks}
                    </div>
                  </HeaderLogoLink>
                )}
              </div>
              {ccMainNav}
              {headerRight(ctx.authControls, ctx.premiumHeaderTag)}
            </div>
            <HeaderFundBar />
          </>
        )}
      />
    </header>
  );
}
