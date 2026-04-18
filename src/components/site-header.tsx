"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
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
  const { isReady } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/portal");
    router.prefetch("/signup");
  }, [router]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setSessionUser(data.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && !t.closest(".profile-dropdown")) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
      // ignore
    } finally {
      setLoadingPortal(false);
    }
  };

  return (
    <header className="relative w-full">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="w-full border-b border-[#1f2937] bg-[#020617]">
              <div className="relative mx-auto max-w-7xl px-4 py-3">
                <div className="flex w-full items-center">
                  {/* LEFT — brand */}
                  <div className="flex min-w-fit items-center gap-3">
                    <Link
                      href="/"
                      className="bg-gradient-to-r from-green-400 via-green-300 to-yellow-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-3xl"
                    >
                      CashCaddies
                    </Link>
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

                  {/* RIGHT — create account + nav + wallet + auth */}
                  <div className="flex shrink-0 items-center gap-3">
                    {!sessionUser ? (
                      <button
                        type="button"
                        onClick={() => router.push("/signup")}
                        className="rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-green-600 md:px-4 md:py-2 md:text-sm"
                      >
                        Create Account
                      </button>
                    ) : null}
                    <div className="hidden items-center gap-3 md:flex" role="navigation" aria-label="Primary">
                      {navItems.map((item) => {
                        const isActive = item.isActive(pathname);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch
                            aria-current={isActive ? "page" : undefined}
                            className={`${navButtonBase} ${
                              isActive
                                ? "border-emerald-500/30 bg-emerald-950/35 text-emerald-300 hover:bg-emerald-950/45"
                                : "text-slate-200"
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                    {ctx.premiumHeaderTag}
                    <HeaderStats />
                    {!isReady ? (
                      ctx.authControls
                    ) : sessionUser ? (
                      <div className="relative profile-dropdown">
                        <button
                          type="button"
                          onClick={() => setProfileOpen(!profileOpen)}
                          className="rounded-md bg-gray-800 px-3 py-2 text-sm text-white"
                        >
                          {sessionUser.email ?? "Account"}
                        </button>

                        {profileOpen ? (
                          <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-800 bg-black shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                router.push("/dashboard");
                                setProfileOpen(false);
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800"
                            >
                              Dashboard
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                router.push("/wallet");
                                setProfileOpen(false);
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800"
                            >
                              Wallet
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                await supabase.auth.signOut();
                                setProfileOpen(false);
                                router.push("/");
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800"
                            >
                              Logout
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <button type="button" onClick={() => router.push("/login")} className="text-sm text-white">
                        Login
                      </button>
                    )}
                    <button
                      type="button"
                      aria-expanded={menuOpen}
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      onClick={() => setMenuOpen((o) => !o)}
                      className="ml-2 text-2xl text-white md:hidden"
                    >
                      ☰
                    </button>
                  </div>
                </div>

                {menuOpen ? (
                  <div className="absolute left-0 top-full z-50 w-full border-t border-gray-800 bg-black md:hidden">
                    <div className="flex flex-col gap-4 p-4">
                      <button
                        type="button"
                        onClick={() => {
                          router.push("/signup");
                          setMenuOpen(false);
                        }}
                        className="text-left text-green-400"
                      >
                        Create Account
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          router.push("/login");
                          setMenuOpen(false);
                        }}
                        className="text-left text-white"
                      >
                        Login
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          router.push("/lobby");
                          setMenuOpen(false);
                        }}
                        className="text-left text-white"
                      >
                        Lobby
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          router.push("/dashboard");
                          setMenuOpen(false);
                        }}
                        className="text-left text-white"
                      >
                        Dashboard
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          router.push("/wallet");
                          setMenuOpen(false);
                        }}
                        className="text-left text-white"
                      >
                        Wallet
                      </button>
                    </div>
                  </div>
                ) : null}
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
