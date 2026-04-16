"use client";

import Image from "next/image";
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
      className="ccMainNav flex min-h-0 min-w-0 flex-1 items-center justify-center gap-8 overflow-x-auto whitespace-nowrap"
      aria-label="Primary"
    >
      {navItems.map((item) => {
        const isActive = item.isActive(pathname);
        return (
          <div key={item.href} className="relative group">
            <div
              className="absolute inset-0 rounded-md p-[2px] bg-gradient-to-br from-green-400 via-emerald-500 to-yellow-400 opacity-70 transition duration-200 group-hover:opacity-100 group-hover:shadow-[0_0_12px_rgba(255,215,0,0.7)]"
            />
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                window.location.href = item.href;
              }}
              className={`metal-shine relative overflow-hidden rounded-md bg-[#020617] px-4 py-2 text-sm font-semibold transform transition duration-200 hover:scale-105 active:scale-95 hover:text-green-300 hover:shadow-[0_0_12px_rgba(255,215,0,0.6)] ${isActive ? "text-green-400" : "text-white"} ${
                isActive ? "shadow-[0_0_14px_rgba(0,255,156,0.75)]" : "shadow-[0_0_6px_rgba(0,255,156,0.4)]"
              }`}
            >
              {item.label}
            </button>
          </div>
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
    <header className="w-full overflow-x-visible overflow-y-hidden border-b border-yellow-500/20 bg-gradient-to-b from-slate-950 to-slate-900">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between px-6 py-6">
              <div className="headerLeft flex min-w-0 shrink-0 items-center gap-6">
                <div className="header-logo-link group inline-flex min-w-0 items-center gap-6">
                  <div className="brandBlock min-w-0">
                    <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                    <div className="brandText hidden min-w-0 flex-col leading-tight md:flex">
                      <div className="flex items-center gap-4">
                        <Image
                          src="/cashcaddies-square.png?v=1"
                          alt="CashCaddies"
                          width={80}
                          height={80}
                          className="h-20 w-20 object-contain"
                          priority
                          unoptimized
                        />
                        <div className="min-w-0">
                          <h1
                            className={
                              ctx.showMinimalHeader
                                ? "brandTitle brandTitle--compact"
                                : "brandTitle"
                            }
                          >
                            CashCaddies
                          </h1>
                          <p className="brandSubtitle">Daily Fantasy Golf Platform</p>
                        </div>
                      </div>
                      {brandLinks}
                    </div>
                  </div>
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
