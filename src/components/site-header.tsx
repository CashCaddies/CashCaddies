"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HeaderAuthSection } from "@/components/header-auth-section";
import { HeaderFundBar } from "@/components/header-fund-bar";
import { HeaderStats } from "@/components/header-stats";

const navItems = [
  {
    href: "/lobby",
    label: "Lobby",
    isActive: (p: string) => p === "/lobby" || p.startsWith("/lobby/"),
  },
  {
    href: "/contests",
    label: "Contests",
    isActive: (p: string) =>
      p === "/contests" ||
      p.startsWith("/contests/") ||
      p === "/dashboard/contests" ||
      p.startsWith("/dashboard/contests/"),
  },
  {
    href: "/lineups",
    label: "Lineups",
    isActive: (p: string) =>
      p === "/lineups" ||
      p.startsWith("/lineups/") ||
      p === "/dashboard/lineups" ||
      p.startsWith("/dashboard/lineups/"),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    isActive: (p: string) =>
      p === "/dashboard" ||
      (p.startsWith("/dashboard/") &&
        !p.startsWith("/dashboard/contests") &&
        !p.startsWith("/dashboard/lineups")),
  },
] as const;

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (logo → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "";

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
      className="ccMainNav flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-x-auto whitespace-nowrap"
      aria-label="Primary"
    >
      <div className="flex items-center gap-3 ml-6">
        {navItems.map((item) => {
          const isActive = item.isActive(pathname);
          return (
            <button
              key={item.href}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                window.location.href = item.href;
              }}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition ${
                isActive
                  ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-300"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );

  const headerRight = (authControls: ReactNode, premiumTag: ReactNode | null) => (
    <div className="headerRight flex shrink-0 items-center gap-4 ml-6">
      {premiumTag}
      <HeaderStats />
      <span className="text-[11px] uppercase tracking-wider text-yellow-400">Premium Golf DFS</span>
      {authControls}
    </div>
  );

  return (
    <header className="w-full overflow-x-visible overflow-y-hidden border-b border-yellow-500/20 bg-[#020617]">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between px-6 py-4">
              <div className="min-w-0 shrink-0">
                <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                <div className="flex items-center gap-5">
                  <div className="flex-shrink-0">
                    <img
                      src="/logo.png?v=1"
                      alt="CashCaddies"
                      className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain rounded-md"
                      loading="eager"
                    />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-2xl font-semibold text-emerald-400 tracking-tight">
                      CashCaddies
                    </span>
                    <span className="text-xs text-gray-400">Daily Fantasy Golf Platform</span>
                    <span className="text-[10px] uppercase tracking-wider text-emerald-300 mt-1">
                      Safety Coverage Fund
                    </span>
                  </div>
                </div>
                <div className="mt-2 hidden md:block">{brandLinks}</div>
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
