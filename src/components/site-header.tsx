"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { HeaderAuthSection } from "@/components/header-auth-section";
import { Tooltip } from "@/components/ui/tooltip";
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
 * Minimal header (brand text → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "";

  const ccMainNav = (
    <div className="ccMainNav flex min-h-0 shrink-0 items-center overflow-x-auto">
      <div className="flex items-center gap-4 md:gap-6" role="navigation" aria-label="Primary">
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
      <div className="flex items-center gap-3 md:gap-5">
        {premiumTag}
        <HeaderStats />
        {authControls}
      </div>
    </div>
  );

  const golfBallElement = (
    <div className="relative flex h-20 w-20 items-center justify-center md:h-24 md:w-24">
      <div className="golf-ball-roll relative h-full w-full">
        <Image
          src="/golf-ball.png"
          alt="Portal"
          fill
          className="pointer-events-none object-contain"
          priority
          sizes="(max-width: 768px) 80px, 96px"
        />
      </div>
    </div>
  );

  return (
    <header className="relative w-full overflow-x-visible overflow-y-visible">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full max-w-[1600px] min-w-0 items-center justify-between gap-4 overflow-visible px-6 py-6 md:py-8 border-b border-white/5 bg-[#020617]/80 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              {/* LEFT: brand */}
              <div className="header-left-brand flex min-w-0 shrink-0 items-center overflow-visible">
                <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                <div className="flex min-w-0 flex-col overflow-visible leading-tight text-left">
                  <span className="text-4xl md:text-5xl font-semibold tracking-tight bg-gradient-to-r from-emerald-400 via-emerald-300 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                    CashCaddies
                  </span>
                  <span className="text-base text-gray-400">Daily Fantasy Golf Platform</span>
                  <Tooltip content={<>Click here to access our FAQ</>}>
                    <Link href="/faq" className="cursor-pointer">
                      <span className="text-sm text-emerald-400 transition hover:text-emerald-300">
                        Safety Coverage Fund
                      </span>
                    </Link>
                  </Tooltip>
                </div>
              </div>

              {/* CENTER: Portal (golf ball) */}
              <div className="flex min-w-0 flex-1 justify-center overflow-visible px-2 md:px-4">
                <div className="header-portal-golf-shell flex shrink-0 items-center justify-center overflow-visible">
                  <Tooltip content={<>Click here to access the CashCaddies Coveted Contest Portal</>}>
                    <Link
                      href="/portal"
                      className="portal-golf-trigger inline-flex cursor-pointer"
                      aria-label="Click here to access the CashCaddies Coveted Contest Portal"
                    >
                      <div className="transition duration-200 hover:scale-105">{golfBallElement}</div>
                    </Link>
                  </Tooltip>
                </div>
              </div>

              {/* RIGHT: nav + wallet + profile */}
              <div className="flex min-w-0 shrink-0 items-center">
                <div className="flex min-w-0 shrink-0 items-center">{ccMainNav}</div>
                <div className="w-6 shrink-0 md:w-14" aria-hidden />
                <div className="flex min-w-0 shrink-0 items-center gap-3 md:gap-5">
                  {headerRight(ctx.authControls, ctx.premiumHeaderTag)}
                </div>
              </div>
            </div>
            <HeaderFundBar />
          </>
        )}
      />
    </header>
  );
}
