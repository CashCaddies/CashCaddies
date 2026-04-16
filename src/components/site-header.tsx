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
      className="ccMainNav flex min-h-0 min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto whitespace-nowrap"
      aria-label="Primary"
    >
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
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-emerald-500/45 bg-emerald-950/35 text-emerald-400"
                : "border-white/10 bg-slate-900/50 text-white hover:border-emerald-500/25 hover:text-emerald-300"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  const headerRight = (authControls: ReactNode, premiumTag: ReactNode | null) => (
    <div className="headerRight flex shrink-0 items-center justify-end gap-4">
      {premiumTag}
      <HeaderStats />
      <span className="mr-4 shrink-0 text-[11px] uppercase tracking-wide text-yellow-400">
        Premium Golf DFS
      </span>
      {authControls}
    </div>
  );

  return (
    <header className="w-full overflow-x-visible overflow-y-hidden border-b border-white/10 bg-gradient-to-b from-slate-950 to-slate-900">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full max-w-7xl items-center gap-4 justify-between px-8 py-6">
              <div className="min-w-0 shrink-0">
                <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <div className="logo-crop flex-shrink-0">
                      <img
                        src="/cashcaddies-square.png"
                        alt="CashCaddies"
                        className="logo-img"
                      />
                    </div>

                    <div className="flex flex-col leading-tight">
                      <span className="text-2xl font-semibold text-emerald-400">CashCaddies</span>
                      <span className="text-xs text-gray-400">Daily Fantasy Golf Platform</span>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-emerald-300">
                    Safety Coverage Fund
                  </span>
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
