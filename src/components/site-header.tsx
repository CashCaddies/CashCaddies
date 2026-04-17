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
    href: "/dashboard",
    label: "Dashboard",
    isActive: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/"),
  },
] as const;

const navButtonBase =
  "rounded-md border border-white/10 bg-white/5 px-5 py-2.5 text-base font-medium transition hover:bg-white/10 whitespace-nowrap";

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (logo → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "";

  const ccMainNav = (
    <div className="ccMainNav flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-x-auto">
      <div className="flex items-center gap-4" role="navigation" aria-label="Primary">
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
                  ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-300 hover:bg-emerald-950/45"
                  : "text-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const headerRight = (authControls: ReactNode, premiumTag: ReactNode | null) => (
    <div className="headerRight flex flex-col items-end gap-1 flex-shrink-0">
      <span className="text-[11px] uppercase tracking-wider text-yellow-400">Premium Golf DFS</span>
      <div className="flex items-center gap-3">
        {premiumTag}
        <HeaderStats />
        {authControls}
      </div>
    </div>
  );

  return (
    <header className="relative w-full overflow-x-visible overflow-y-visible">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full max-w-[1600px] min-w-0 items-center justify-between gap-3 overflow-visible px-8 py-6 md:py-8 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              <div className="headerLeft flex min-w-0 shrink-0 items-center gap-5 md:gap-8">
                <div className="flex items-center gap-6">
                  <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                  <div className="relative flex-shrink-0">
                    <img
                      src="/logo.png?v=1"
                      alt="CashCaddies"
                      className="h-20 w-20 object-contain rounded-md brightness-110 contrast-110 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] md:h-24 md:w-24"
                      loading="eager"
                    />
                  </div>

                  <div className="flex flex-col leading-tight">
                    <span className="text-3xl font-semibold tracking-tight text-emerald-400 md:text-4xl">
                      CashCaddies
                    </span>
                    <span className="text-sm text-gray-400">Daily Fantasy Golf Platform</span>
                    <span className="mt-1 text-xs uppercase tracking-wider text-emerald-300">
                      Safety Coverage Fund
                    </span>
                  </div>
                </div>

                <div className="header-portal-golf-shell flex shrink-0 min-w-fit items-center justify-center">
                  <Link
                    href="/portal"
                    title="CashCaddies Portal to qualified contests"
                    className="group flex items-center justify-center rounded-md p-1 transition-colors hover:bg-white/5"
                    aria-label="Open portal"
                  >
                    <div className="relative flex h-16 w-16 items-center justify-center md:h-20 md:w-20">
                      <div className="golf-ball-spin relative h-full w-full">
                        <Image
                          src="/golf-ball.png"
                          alt="Portal"
                          fill
                          className="object-contain transition-transform duration-200 group-hover:scale-105"
                          priority
                          sizes="(max-width: 768px) 64px, 80px"
                        />
                      </div>
                    </div>
                  </Link>
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
