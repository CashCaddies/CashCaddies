"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
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
  const router = useRouter();
  async function handlePortalClick(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    router.push("/portal");
  }

  const ccMainNav = (
    <div className="ccMainNav flex min-h-0 w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:items-center md:overflow-x-auto">
      <div
        className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:gap-4 lg:gap-6"
        role="navigation"
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
              className={`${navButtonBase} w-full text-center md:w-auto ${
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
    <div className="headerRight flex w-full flex-shrink-0 flex-col items-end gap-1 md:w-auto">
      <span className="text-[11px] uppercase tracking-wider text-yellow-400">Premium Golf DFS</span>
      <div className="flex w-full flex-wrap items-center justify-end gap-3 md:w-auto md:gap-5">
        {premiumTag}
        <HeaderStats />
        {authControls}
      </div>
    </div>
  );

  const golfBallElement = (
    <div className="relative ml-2 h-10 w-10 shrink-0 md:h-12 md:w-12">
      <div className="golf-ball-roll relative h-full w-full">
        <Image
          src="/golf-ball.png"
          alt="Portal"
          fill
          className="pointer-events-none object-contain"
          priority
          sizes="(max-width: 768px) 40px, 48px"
        />
      </div>
    </div>
  );

  return (
    <header className="relative w-full overflow-x-visible overflow-y-visible">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="headerContainer mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-2 overflow-visible border-b border-white/5 bg-[#020617]/80 px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-md md:flex-row md:items-center md:justify-between">
              {/* Brand: title + ball on one row; subtitle + links below */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 bg-gradient-to-r from-emerald-400 via-emerald-300 to-yellow-400 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] md:text-3xl">
                    CashCaddies
                  </span>
                  <div className="header-portal-golf-shell flex shrink-0 items-center justify-center overflow-visible">
                    <Tooltip content={<>Click here to access the CashCaddies Coveted Contest Portal</>}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Click here to access the CashCaddies Coveted Contest Portal"
                        onClick={handlePortalClick}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                        className="portal-golf-trigger inline-flex cursor-pointer"
                      >
                        <div className="transition duration-200 hover:scale-105">{golfBallElement}</div>
                      </div>
                    </Tooltip>
                  </div>
                </div>
                <span className="text-sm text-gray-400 md:text-base">Daily Fantasy Golf Platform</span>
                <Tooltip content={<>Click here to access our FAQ</>}>
                  <Link href="/faq" className="cursor-pointer">
                    <span className="text-sm text-emerald-400 transition hover:text-emerald-300">
                      Safety Coverage Fund
                    </span>
                  </Link>
                </Tooltip>
              </div>

              {/* Nav + wallet + profile */}
              <div className="mt-2 flex min-w-0 w-full flex-col items-stretch gap-2 md:mt-0 md:w-auto md:flex-row md:items-center md:justify-end md:gap-4">
                <div className="flex min-w-0 shrink-0 items-center justify-center md:justify-end">{ccMainNav}</div>
                <div className="hidden w-px shrink-0 self-stretch bg-white/10 md:block" aria-hidden />
                <div className="flex min-w-0 shrink-0 items-center justify-end gap-3 md:gap-5">
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
