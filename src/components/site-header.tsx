"use client";

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

const navButtonBase =
  "px-4 py-2 rounded-md border text-sm font-medium whitespace-nowrap transition";

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (logo → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "";

  const ccMainNav = (
    <div className="ccMainNav flex min-h-0 min-w-0 flex-1 justify-center overflow-x-auto">
      <nav className="flex items-center gap-4" aria-label="Primary">
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
              className={`${navButtonBase} ${
                isActive
                  ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-300"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );

  const headerRight = (authControls: ReactNode, premiumTag: ReactNode | null) => (
    <div className="headerRight flex shrink-0 items-center gap-5">
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
            <div className="headerContainer mx-auto flex w-full max-w-[1400px] min-w-0 items-center justify-between px-8 py-6">
              <div className="flex items-center gap-5 flex-shrink-0">
                <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                <div className="flex-shrink-0">
                  <img
                    src="/logo.png?v=1"
                    alt="CashCaddies"
                    className="h-28 w-28 sm:h-32 sm:w-32 md:h-36 md:w-36 object-contain rounded-md"
                    loading="eager"
                  />
                </div>

                <div className="flex flex-col leading-tight">
                  <span className="text-3xl font-semibold text-emerald-400 tracking-tight">
                    CashCaddies
                  </span>
                  <span className="text-sm text-gray-400">Daily Fantasy Golf Platform</span>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-300 mt-1">
                    Safety Coverage Fund
                  </span>
                </div>
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
