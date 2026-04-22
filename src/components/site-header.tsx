"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase/client";
import { isAdminRole, isSeniorAdminRole } from "@/lib/auth/roles";
import { isFounder } from "@/lib/userRoles";
import { playCupSound, playPortalSound } from "@/lib/sounds";
import { HeaderAuthSection } from "@/components/header-auth-section";
import { HeaderFundBar } from "@/components/header-fund-bar";
import { HeaderStats } from "@/components/header-stats";
import golfBall from "../../public/golf-ball.png";

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
  "rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-[15px] font-medium transition-all duration-200 ease-out hover:border-emerald-500/35 hover:bg-emerald-950/30 hover:shadow-[0_0_22px_rgba(16,185,129,0.18)] whitespace-nowrap";

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (brand text → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, session } = useAuth();
  const [profile, setProfile] = useState<any>(null);
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
  const [isEntering, setIsEntering] = useState(false);

  const email = session?.user?.email;
  const founder = isFounder(profile);
  const isAdmin = isAdminRole(profile?.role);
  const privilegedAdmin = isSeniorAdminRole(profile?.role);

  useEffect(() => {
    const loadProfile = async () => {
      if (!supabase) return;
      if (!session?.user?.id) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        setProfile(null);
        return;
      }
      setProfile(data ?? null);
    };

    void loadProfile();
  }, [session]);

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

  const handlePortalEntry = async () => {
    playPortalSound();
    setIsEntering(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setTimeout(() => {
      if (!session?.user) {
        router.push("/login?next=/portal");
        setIsEntering(false);
        return;
      }

      router.push("/portal");
      setIsEntering(false);
    }, 180);
  };

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.split("@")[0].slice(0, 2).toUpperCase();
  };

  return (
    <header className="relative w-full">
      {isEntering && (
        <div className="pointer-events-none fixed inset-0 z-[999] flex items-center justify-center">
          <div className="animate-portal-entry-screen absolute inset-0 bg-black/20" />

          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 animate-flash rounded-full bg-yellow-400/20 blur-3xl" />
        </div>
      )}
      <HeaderAuthSection
        render={(ctx) => (
          <>
            <div className="w-full border-b border-white/[0.06] bg-[#020617]">
              <div className="relative mx-auto max-w-5xl px-4 py-3 md:py-4">
                <div className="flex w-full flex-col items-stretch gap-4 md:grid md:grid-cols-3 md:items-center md:gap-4 lg:gap-6">
                  {/* LEFT — brand */}
                  <div className="flex min-w-0 items-center justify-center md:col-start-2">
                    <div className="flex flex-col items-center justify-center text-center">
                      <Link
                        href="/"
                        className="bg-gradient-to-r from-green-400 via-green-300 to-yellow-400 bg-clip-text text-[2rem] font-semibold tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(52,211,153,0.2)] md:text-[2.35rem]"
                      >
                        CashCaddies
                      </Link>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/90 md:text-xs">
                        PREMIUM GOLF DFS
                      </span>
                    </div>
                  </div>

                  {/* CENTER — ball */}
                  <div className="flex items-center justify-center md:col-start-1 md:justify-start">
                    <div className="flex min-w-[140px] flex-shrink-0 flex-col items-center justify-center">
                      <div>
                        <button
                          type="button"
                          aria-label="Enter CC Portal"
                          onClick={handlePortalEntry}
                          className="group relative cursor-pointer transition-transform duration-200 ease-out will-change-transform hover:scale-[1.07] hover:rotate-2 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020617]"
                        >
                          <div className="relative flex items-center justify-center">
                            <div
                              className="
    pointer-events-none absolute inset-0
    scale-125 rounded-full
    bg-yellow-400/40 blur-2xl
    animate-portal-glow
  "
                            />
                            <div
                              className="
    pointer-events-none absolute inset-0
    scale-110 rounded-full
    bg-yellow-300/30 blur-xl
    animate-portal-glow-inner
  "
                            />
                            <div className="relative z-10 flex items-center justify-center bg-transparent">
                              <Image
                                src={golfBall}
                                alt="portal"
                                width={56}
                                height={56}
                                className="pointer-events-none h-14 w-14 animate-[portalFloat_3s_ease-in-out_infinite] cursor-pointer object-contain drop-shadow-[0_0_11px_rgba(250,204,21,0.36)] transition duration-300 ease-out group-hover:scale-[1.1] group-hover:rotate-3 group-hover:drop-shadow-[0_0_26px_rgba(250,204,21,0.78)] group-active:scale-[0.95] md:h-20 md:w-20"
                              />
                            </div>
                          </div>
                        </button>
                      </div>
                      <div
                        onClick={handlePortalEntry}
                        className="mt-1 cursor-pointer whitespace-nowrap text-center text-[11px] font-semibold tracking-[0.03em] text-emerald-300/90 transition-all duration-200 hover:scale-[1.02] hover:text-emerald-200 hover:underline md:text-xs"
                      >
                        Click to enter CC Portal
                      </div>
                      <Link
                        href="/faq"
                        className="mt-2 inline-flex items-center justify-center rounded-xl border border-amber-500/25 bg-slate-900/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100/95 shadow-[inset_0_1px_0_0_rgba(234,179,64,0.08)] transition-all duration-200 hover:border-emerald-500/40 hover:bg-slate-900/85 hover:text-emerald-200 hover:shadow-[0_0_18px_rgba(52,211,153,0.15)] md:text-xs"
                      >
                        FAQ
                      </Link>
                    </div>
                  </div>

                  {/* RIGHT — create account + nav + wallet + auth */}
                  <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 md:col-start-3 md:justify-end">
                    {!sessionUser ? (
                      <button
                        type="button"
                        onClick={() => router.push("/signup")}
                        className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-all duration-200 ease-out hover:bg-emerald-400 hover:shadow-[0_0_24px_rgba(52,211,153,0.35)] md:px-5 md:py-3 md:text-[15px]"
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
                                ? "border-emerald-500/35 bg-emerald-950/40 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.12)] hover:bg-emerald-950/50 hover:shadow-[0_0_24px_rgba(16,185,129,0.22)]"
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
                              className="notif-bell relative rounded-lg p-0.5 text-lg text-white transition-all duration-200 hover:bg-white/5"
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
                                    className="mb-2 text-xs text-green-400 transition-colors duration-200 hover:text-emerald-300"
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
                                    className="mt-2 text-green-400 transition-colors duration-200 hover:text-emerald-300"
                                  >
                                    View All
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="relative profile-dropdown flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setNotifOpen(false);
                            setProfileOpen(!profileOpen);
                          }}
                          className="rounded-full transition-all duration-200 hover:ring-2 hover:ring-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-black">
                            {getInitials(sessionUser?.email)}
                          </div>
                        </button>
                        {privilegedAdmin ? (
                          <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded">Owner</span>
                        ) : null}
                        {!privilegedAdmin && founder ? (
                          <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
                            Founding Member
                          </span>
                        ) : null}

                        {profileOpen ? (
                          <div className="absolute right-0 z-50 mt-2 w-48 rounded-md border border-gray-800 bg-black shadow-lg">
                            <button
                              type="button"
                              onClick={() => {
                                void handleProtectedNav("/dashboard").then((ok) => {
                                  if (ok) setProfileOpen(false);
                                });
                              }}
                              className="block w-full px-4 py-2 text-left text-sm text-white transition-colors duration-200 hover:bg-gray-800"
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
                              className="block w-full px-4 py-2 text-left text-sm text-white transition-colors duration-200 hover:bg-gray-800"
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
                                  className="block w-full text-left px-4 py-2 text-sm text-yellow-400 transition-colors duration-200 hover:bg-gray-800"
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
                                  className="block w-full text-left px-4 py-2 text-sm text-white transition-colors duration-200 hover:bg-gray-800"
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
                              className="block w-full px-4 py-2 text-left text-sm text-red-400 transition-colors duration-200 hover:bg-gray-800"
                            >
                              Logout
                            </button>
                          </div>
                        ) : null}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => router.push("/login")}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.06)]"
                      >
                        Login
                      </button>
                    )}
                    <button
                      type="button"
                      aria-expanded={menuOpen}
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      onClick={() => setMenuOpen((o) => !o)}
                      className="ml-2 rounded-lg p-1 text-2xl text-white transition-all duration-200 hover:bg-white/10 md:hidden"
                    >
                      ☰
                    </button>
                  </div>
                </div>

                {menuOpen ? (
                  <div className="absolute left-0 top-full z-50 w-full border-t border-white/10 bg-black md:hidden">
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
                            className="rounded-lg px-1 py-1 text-left text-white transition-colors duration-200 hover:bg-white/5"
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
                            className="rounded-lg px-1 py-1 text-left text-white transition-colors duration-200 hover:bg-white/5"
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
                            className="rounded-lg px-1 py-1 text-left text-red-400 transition-colors duration-200 hover:bg-red-500/10"
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
                            className="rounded-lg px-1 py-1 text-left text-white transition-colors duration-200 hover:bg-white/5"
                          >
                            Login
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              router.push("/signup");
                              setMenuOpen(false);
                            }}
                            className="rounded-lg px-1 py-1 text-left text-emerald-400 transition-colors duration-200 hover:bg-emerald-500/10"
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
                        className="rounded-lg px-1 py-1 text-left text-white transition-colors duration-200 hover:bg-white/5"
                      >
                        Lobby
                      </button>

                      <Link
                        href="/faq"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-lg px-1 py-1 text-left font-medium text-amber-300 transition-colors duration-200 hover:bg-amber-500/10 hover:text-amber-200"
                      >
                        FAQ
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mx-auto max-w-5xl border-t border-slate-500/20 px-4 pb-3 pt-2.5">
                <div className="flex max-w-fit flex-wrap items-center justify-center gap-x-3 gap-y-1 md:justify-start">
                  <Link
                    href="/faq#safety-coverage"
                    className="text-sm font-medium text-green-400 underline decoration-green-500/30 underline-offset-4 transition-all duration-200 hover:text-emerald-300 hover:decoration-emerald-400/50 md:text-base"
                  >
                    Safety Coverage Fund
                  </Link>
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
