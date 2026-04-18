"use client";

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
    <div className="ccMainNav flex min-h-0 shrink-0 flex-col gap-2 md:flex-row md:items-center md:overflow-x-auto">
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
    <div className="headerRight flex w-full flex-shrink-0 flex-col items-end md:w-auto">
      <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto md:gap-3">
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
            <div className="headerContainer mx-auto w-full max-w-[1600px] min-w-0 overflow-visible border-b border-white/10 bg-[#020617]/80 px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-2">
                {/* LEFT — brand text only */}
                <div className="flex min-w-0 items-center gap-3">
                  <span className="sr-only">CashCaddies</span>
                  <span className="min-w-0 bg-gradient-to-r from-emerald-400 via-emerald-300 to-yellow-400 bg-clip-text text-2xl font-bold leading-tight tracking-tight text-transparent drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] md:text-3xl">
                    CashCaddies
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Portal"
                    onClick={handlePortalClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.currentTarget.click();
                      }
                    }}
                    className="flex cursor-pointer items-center justify-center"
                  >
                    <img
                      src="/golf-ball.png"
                      alt="Portal"
                      className="h-10 w-10 object-contain transition hover:scale-105 md:h-12 md:w-12"
                    />
                  </div>

                  {/* RIGHT — Lobby / Dashboard + wallet + profile */}
                  <div className="flex min-w-0 shrink-0 items-center gap-2 md:gap-4">
                    {ccMainNav}
                    <div className="hidden h-8 w-px shrink-0 bg-white/10 sm:block" aria-hidden />
                    {headerRight(ctx.authControls, ctx.premiumHeaderTag)}
                  </div>
                </div>
              </div>

              {/* SECOND ROW — Safety + Premium (grouped under left) */}
              <div className="mt-2 pt-1">
                <div className="flex items-center gap-2 text-sm md:text-base whitespace-nowrap max-w-fit">
                  <Tooltip content={<>Click here to access our FAQ</>}>
                    <Link href="/faq#safety-coverage" className="text-emerald-400/90 transition hover:text-emerald-300">
                      Safety Coverage Fund
                    </Link>
                  </Tooltip>
                  <span className="ml-2 font-semibold text-yellow-400">PREMIUM GOLF DFS</span>
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
