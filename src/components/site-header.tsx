"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/portal");
  }, [router]);

  const handlePortalClick = async () => {
    setLoadingPortal(true);
    try {
      const { data } = await supabase.auth.getUser();

      if (!data?.user) {
        router.push("/login");
        return;
      }

      router.push("/portal");
    } catch {
      setLoadingPortal(false);
    }
  };

  return (
    <header className="w-full">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="w-full border-b border-[#1f2937] bg-[#020617]">
              <div className="mx-auto max-w-7xl px-4 py-3">
                <div className="flex w-full items-center">
                  {/* LEFT — brand */}
                  <div className="flex min-w-fit items-center gap-3">
                    <h1 className="bg-gradient-to-r from-green-400 via-green-300 to-yellow-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-3xl">
                      CashCaddies
                    </h1>
                  </div>

                  {/* CENTER — ball */}
                  <div className="flex flex-1 justify-center">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-busy={loadingPortal}
                      aria-label="Portal"
                      onClick={() => {
                        if (loadingPortal) return;
                        void handlePortalClick();
                      }}
                      onKeyDown={(e) => {
                        if (loadingPortal) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void handlePortalClick();
                        }
                      }}
                      className="group relative cursor-pointer transition-transform active:scale-95"
                    >
                      <div className="absolute inset-0 animate-[portalGlow_2.5s_ease-in-out_infinite] rounded-full bg-green-500/20 blur-xl" />
                      <div className="absolute inset-0 scale-110 rounded-full border border-green-400/40 transition duration-300 group-hover:scale-125" />
                      <img
                        src="/golf-ball.png"
                        alt="Portal"
                        className={`relative h-16 w-16 animate-[portalFloat_3s_ease-in-out_infinite] object-contain transition duration-300 group-hover:scale-110 group-hover:rotate-6 group-active:scale-90 md:h-20 md:w-20 ${loadingPortal ? "scale-95 opacity-70" : ""}`}
                      />
                      {loadingPortal ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-[1] rounded-full border-2 border-green-400 animate-ping"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* RIGHT — nav + wallet + auth */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden items-center gap-4 md:flex" role="navigation" aria-label="Primary">
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
                    {ctx.premiumHeaderTag}
                    <HeaderStats />
                    {ctx.authControls}
                  </div>
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
