"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { supabase } from "@/lib/supabase/client";
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

  return (
    <header className="w-full">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="w-full border-b border-[#1f2937] bg-[#020617]">
              <div className="mx-auto flex max-w-7xl items-center px-4 py-3">
                {/* LEFT — brand + portal */}
                <div className="flex min-w-fit items-center gap-4">
                  <h1 className="text-2xl font-semibold tracking-tight text-green-400 md:text-3xl">CashCaddies</h1>
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
                      className="h-16 w-16 object-contain transition hover:scale-105 md:h-20 md:w-20"
                    />
                  </div>
                </div>

                {/* CENTER — Lobby / Dashboard */}
                <div className="ml-auto hidden items-center gap-4 md:flex" role="navigation" aria-label="Primary">
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

                {/* RIGHT — wallet + premium + auth */}
                <div className="flex shrink-0 items-center gap-3">
                  {ctx.premiumHeaderTag}
                  <HeaderStats />
                  {ctx.authControls}
                </div>
              </div>

              <div className="mx-auto max-w-7xl px-4 pb-3 pt-1">
                <div className="flex max-w-fit items-center gap-2 whitespace-nowrap">
                  <Link href="/faq#safety-coverage" className="text-sm text-green-400 transition hover:text-green-300 md:text-base">
                    Safety Coverage Fund
                  </Link>
                  <span className="text-sm text-yellow-400 md:text-base">PREMIUM GOLF DFS</span>
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
