"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { playCupSound } from "@/lib/sound";
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
  const pathname = usePathname();
  const router = useRouter();
  const { isReady } = useAuth();
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifCounts, setNotifCounts] = useState({
    approvals: 0,
    support: 0,
    bugs: 0,
  });
  const [notifOpen, setNotifOpen] = useState(false);
  const [prevTotal, setPrevTotal] = useState(0);

  const isAdmin = sessionUser?.email === "cashcaddies@outlook.com";

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
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const total = notifCounts.approvals + notifCounts.support + notifCounts.bugs;

    if (total > prevTotal && prevTotal !== 0) {
      void playCupSound();
    }

    setPrevTotal(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- [notifCounts] only; prevTotal/playCupSound per spec
  }, [notifCounts]);

  const fetchNotifications = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/admin/notifications", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) return;

      const json = await res.json();
      setNotifCounts(json);
    } catch (e) {
      console.error("notif fetch failed");
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchNotifications();
  }, [isAdmin, fetchNotifications]);

  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(() => {
      void fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [isAdmin, fetchNotifications]);

  useEffect(() => {
    if (notifOpen) {
      void fetchNotifications();
    }
  }, [notifOpen, fetchNotifications]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const t = e.target;
      if (
        t instanceof Element &&
        !t.closest(".profile-dropdown") &&
        !t.closest(".notif-panel") &&
        !t.closest(".notif-bell")
      ) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleProtectedNav = async (path: string): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const next = encodeURIComponent(path);
      window.location.href = `/login?next=${next}`;
      return false;
    }
    router.push(path);
    return true;
  };

  const handleGolfBallClick = () => {
    playCupSound();
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      } else {
        router.push("/lobby");
      }
    })();
  };

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.split("@")[0].slice(0, 2).toUpperCase();
  };

  return (
    <header className="relative w-full">
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="w-full border-b border-[#1f2937] bg-[#020617]">
              <div className="relative mx-auto max-w-7xl px-4 py-3">
                <div className="flex w-full items-center justify-between gap-6 md:gap-8">
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
                    <div className="flex min-w-[140px] flex-shrink-0 flex-col items-center justify-center">
                      <div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Portal"
                          onClick={handleGolfBallClick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleGolfBallClick();
                          }}
                          className="group relative cursor-pointer transition-opacity transition-transform active:scale-95"
                        >
                          <div className="absolute inset-0 animate-[portalGlow_2.5s_ease-in-out_infinite] rounded-full bg-green-500/20 blur-xl" />
                          <div className="absolute inset-0 scale-110 rounded-full border border-green-400/40 transition duration-300 group-hover:scale-125" />
                          <img
                            src="/golf-ball.png"
                            alt="Portal"
                            className="relative h-16 w-16 animate-[portalFloat_3s_ease-in-out_infinite] object-contain transition duration-300 group-hover:scale-110 group-hover:rotate-6 group-active:scale-90 md:h-20 md:w-20"
                          />
                        </div>
                      </div>
                      <div
                        onClick={handleGolfBallClick}
                        className="mt-1 cursor-pointer text-center text-[10px] text-green-400 whitespace-nowrap transition-all hover:opacity-80 hover:scale-[1.02] hover:underline md:text-xs"
                      >
                        Click to enter your qualified contests
                      </div>
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
                        const isActive = item.isActive(pathname ?? "");
                        return (
                          <button
                            key={item.href}
                            type="button"
                            aria-current={isActive ? "page" : undefined}
                            onClick={() => void handleProtectedNav(item.href)}
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
                    {!isReady ? (
                      ctx.authControls
                    ) : sessionUser ? (
                      <div className="flex items-center gap-2">
                        {isAdmin ? (
                          <div className="relative flex items-center">
                            <button
                              type="button"
                              className="notif-bell relative text-lg text-white"
                              onClick={() => {
                                setNotifOpen((o) => !o);
                                setProfileOpen(false);
                              }}
                              aria-label="Notifications"
                            >
                              🔔
                              {notifCounts.approvals + notifCounts.support + notifCounts.bugs > 0 ? (
                                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-xs text-white">
                                  {notifCounts.approvals + notifCounts.support + notifCounts.bugs}
                                </span>
                              ) : null}
                            </button>
                            {notifOpen ? (
                              <div className="notif-panel absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-gray-800 bg-black shadow-lg">
                                <div className="p-3 text-sm text-white">
                                  <div className="mb-2 font-semibold">Notifications</div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const {
                                        data: { session },
                                      } = await supabase.auth.getSession();

                                      await fetch("/api/admin/notifications/read-all", {
                                        method: "PATCH",
                                        headers: {
                                          Authorization: `Bearer ${session?.access_token}`,
                                        },
                                      });

                                      setNotifCounts({
                                        approvals: 0,
                                        support: 0,
                                        bugs: 0,
                                      });
                                      setNotifOpen(false);
                                    }}
                                    className="mb-2 text-xs text-green-400"
                                  >
                                    Mark all as read
                                  </button>
                                  <div>Approvals: {notifCounts.approvals}</div>
                                  <div>Support: {notifCounts.support}</div>
                                  <div>Bugs: {notifCounts.bugs}</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleProtectedNav("/admin/notifications").then((ok) => {
                                        if (ok) setNotifOpen(false);
                                      });
                                    }}
                                    className="mt-2 text-green-400"
                                  >
                                    View All
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="relative profile-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setNotifOpen(false);
                            setProfileOpen(!profileOpen);
                          }}
                          className="rounded-full focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-black">
                            {getInitials(sessionUser?.email)}
                          </div>
                        </button>

                        {profileOpen ? (
                          <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-800 bg-black shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                void handleProtectedNav("/dashboard").then((ok) => {
                                  if (ok) setProfileOpen(false);
                                });
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800"
                            >
                              Dashboard
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                void handleProtectedNav("/wallet").then((ok) => {
                                  if (ok) setProfileOpen(false);
                                });
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800"
                            >
                              Wallet
                            </button>

                            {isAdmin && (
                              <>
                                <div className="border-t border-gray-800 my-1" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleProtectedNav("/admin").then((ok) => {
                                      if (ok) setProfileOpen(false);
                                    });
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-gray-800"
                                >
                                  Admin Tools
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleProtectedNav("/admin/notifications").then((ok) => {
                                      if (ok) setProfileOpen(false);
                                    });
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800"
                                >
                                  Notifications
                                  <span className="ml-2 text-green-400 text-xs">
                                    ({notifCounts.approvals + notifCounts.support + notifCounts.bugs})
                                  </span>
                                </button>

                                <div className="pl-4 pb-2 text-xs text-gray-400">
                                  {`Approvals (${notifCounts.approvals}) • Support (${notifCounts.support}) • Bugs (${notifCounts.bugs})`}
                                </div>
                              </>
                            )}

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
                      {sessionUser ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void handleProtectedNav("/dashboard").then((ok) => {
                                if (ok) setMenuOpen(false);
                              });
                            }}
                            className="text-left text-white"
                          >
                            Dashboard
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              void handleProtectedNav("/wallet").then((ok) => {
                                if (ok) setMenuOpen(false);
                              });
                            }}
                            className="text-left text-white"
                          >
                            Wallet
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              await supabase.auth.signOut();
                              setMenuOpen(false);
                              router.push("/");
                            }}
                            className="text-left text-red-400"
                          >
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
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
                              router.push("/signup");
                              setMenuOpen(false);
                            }}
                            className="text-left text-green-400"
                          >
                            Create Account
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          void handleProtectedNav("/lobby").then((ok) => {
                            if (ok) setMenuOpen(false);
                          });
                        }}
                        className="text-left text-white"
                      >
                        Lobby
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
