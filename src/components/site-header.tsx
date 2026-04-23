"use client";

import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { Shield } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { supabase } from "@/lib/supabase/client";
import { isSeniorAdminRole } from "@/lib/auth/roles";
import { isFounder } from "@/lib/userRoles";
import { formatMoney } from "@/lib/wallet";
import { playPortalSound } from "@/lib/sounds";
import { HeaderAuthSection } from "@/components/header-auth-section";
import { HeaderRotatingStatus } from "@/components/header-fund-bar";
import { DashboardNav } from "@/components/dashboard-nav";
import golfBall from "../../public/golf-ball.png";

/** Shared inner width/alignment for the header right rail (logged out, loading, or ready). */
const headerRightRailInner =
  "header-right-rail relative flex w-full max-w-[16.5rem] flex-col items-center gap-2.5 md:max-w-[14.5rem] md:items-end";

/**
 * Full DFS header when user has beta or admin access.
 * Minimal header (brand text → closed beta, badge, login/account) when logged out or not approved.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isReady, session } = useAuth();
  const { wallet, loading: walletLoading } = useWallet();
  const [profile, setProfile] = useState<any>(null);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEntering, setIsEntering] = useState(false);

  const founder = isFounder(profile);
  const privilegedAdmin = isSeniorAdminRole(profile?.role);

  const accountBalanceUsd =
    walletLoading || !wallet ? null : Number(wallet.wallet_balance ?? wallet.account_balance);
  const walletDisplay = walletLoading ? "…" : accountBalanceUsd != null ? formatMoney(accountBalanceUsd) : "—";
  const protectionCreditDisplay = walletLoading
    ? "…"
    : formatMoney(Number(wallet?.protection_credit_balance ?? 0));

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
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
      }
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

  const handleLabel =
    typeof profile?.username === "string" && profile.username.trim().length > 0
      ? `@${profile.username.trim()}`
      : sessionUser?.email
        ? `@${sessionUser.email.split("@")[0]}`
        : "@user";

  const avatarUrl =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim().length > 0
      ? profile.avatar_url.trim()
      : null;

  const rightRailClass =
    sessionUser && isReady ? `${headerRightRailInner} profile-dropdown` : headerRightRailInner;

  const isPublicAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname?.startsWith("/login/") === true ||
    pathname?.startsWith("/signup/") === true;
  const showFullAppChrome = Boolean(sessionUser && isReady && !isPublicAuthPage);

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
                <div className="flex w-full flex-col items-stretch gap-5 md:grid md:grid-cols-3 md:items-start md:gap-4 lg:gap-6">
                  {/* LEFT — portal + wallet (hidden on login/signup for a simpler public header) */}
                  <div className="order-1 flex items-center justify-center md:col-start-1 md:justify-start md:pt-1">
                    <div className="flex w-full max-w-[16.5rem] min-w-[140px] flex-shrink-0 flex-col items-center justify-center md:max-w-[14.5rem]">
                      {isPublicAuthPage ? (
                        <Link
                          href="/"
                          className="text-sm font-semibold text-slate-400 transition-colors hover:text-emerald-300"
                        >
                          ← Home
                        </Link>
                      ) : (
                        <>
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
                                    width={88}
                                    height={88}
                                    className="pointer-events-none h-[4.5rem] w-[4.5rem] animate-[portalFloat_3s_ease-in-out_infinite] cursor-pointer object-contain drop-shadow-[0_0_11px_rgba(250,204,21,0.36)] transition duration-300 ease-out group-hover:scale-[1.1] group-hover:rotate-3 group-hover:drop-shadow-[0_0_26px_rgba(250,204,21,0.78)] group-active:scale-[0.95] md:h-24 md:w-24"
                                  />
                                </div>
                              </div>
                            </button>
                          </div>
                          <div
                            onClick={handlePortalEntry}
                            className="mt-1 cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-center text-base font-semibold leading-tight text-emerald-300 tracking-normal transition-all transition-colors hover:bg-emerald-400/10 hover:text-white"
                          >
                            C.C. Clubhouse Portal
                          </div>

                          {showFullAppChrome ? (
                            <Link
                              href="/wallet"
                              prefetch
                              className="mt-3 w-full rounded-xl border border-amber-500/20 bg-gradient-to-b from-slate-900/80 to-slate-950 p-2.5 shadow-[inset_0_1px_0_0_rgba(250,204,21,0.05),0_6px_22px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-amber-400/35 hover:shadow-[0_8px_26px_rgba(250,204,21,0.07)]"
                              title="Open wallet"
                              aria-label={`Wallet ${walletDisplay}, Lifetime Protection Contributions ${protectionCreditDisplay}. Open wallet.`}
                            >
                              <div className="flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  Wallet
                                </span>
                                <span className="font-semibold tabular-nums text-yellow-200">{walletDisplay}</span>
                              </div>
                              <div className="mt-2 space-y-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="max-w-[58%] text-[9px] font-semibold uppercase leading-tight tracking-[0.12em] text-slate-500">
                                    Lifetime Protection Contributions
                                  </span>
                                  <span className="text-right text-sm font-semibold tabular-nums text-emerald-300/95">
                                    {protectionCreditDisplay}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {/* CENTER — brand + primary nav */}
                  <div className="order-2 flex min-w-0 items-center justify-center md:col-start-2 md:pt-0">
                    <div className="flex flex-col items-center justify-center text-center md:translate-y-[6px]">
                      {!isPublicAuthPage ? <HeaderRotatingStatus /> : null}
                      <Link
                        href="/"
                        className="bg-gradient-to-r from-green-400 via-green-300 to-yellow-400 bg-clip-text text-[2rem] font-semibold tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(52,211,153,0.2)] md:text-[2.35rem]"
                      >
                        CashCaddies
                      </Link>
                      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-300/90 md:text-xs">
                        PREMIUM GOLF DFS
                      </span>
                      <Link
                        href="/faq"
                        className="mt-2 inline-flex items-center justify-center rounded-full border border-yellow-500/40 px-3 py-1 text-xs font-medium tracking-wide text-yellow-300/90 hover:border-yellow-400 hover:text-yellow-200 transition-all duration-200"
                      >
                        FAQ
                      </Link>
                      {showFullAppChrome ? (
                        <div className="mt-3 w-full max-w-xl px-1" role="navigation" aria-label="App">
                          <DashboardNav />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* RIGHT — account / auth (shared rail; content only varies by state) */}
                  <div className="order-3 flex w-full min-w-0 shrink-0 flex-col items-center gap-3 md:col-start-3 md:items-end md:pt-1">
                    <div className={rightRailClass}>
                      {!sessionUser ? (
                        <div className="flex w-full flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => router.push("/signup")}
                            className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-black transition-all duration-200 ease-out hover:bg-emerald-400 hover:shadow-[0_0_24px_rgba(52,211,153,0.35)] md:px-5 md:py-3 md:text-[15px]"
                          >
                            Create Account
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push("/login")}
                            className="w-full rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-200 transition-all duration-200 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_18px_rgba(255,255,255,0.06)]"
                          >
                            Login
                          </button>
                        </div>
                      ) : !isReady ? (
                        <div className="flex w-full flex-col items-center md:items-end">{ctx.authControls}</div>
                      ) : (
                        <>
                          <div
                            className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-full border border-amber-300/35 bg-gradient-to-b from-slate-900/40 to-slate-950/80 shadow-[0_0_0_1px_rgba(0,0,0,0.35),0_12px_36px_-16px_rgba(250,204,21,0.35)] ring-1 ring-amber-400/20 md:h-[6.25rem] md:w-[6.25rem]"
                            aria-hidden
                          >
                            {avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URLs
                              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-950 text-lg font-bold text-white md:text-xl">
                                {getInitials(sessionUser?.email)}
                              </div>
                            )}
                          </div>

                          <div className="flex w-full items-center justify-center gap-1.5 md:justify-end">
                            <button
                              type="button"
                              className="profile-handle-trigger max-w-[min(100%,11rem)] truncate rounded-md px-1 py-0.5 text-center text-[15px] font-semibold leading-snug tracking-tight text-slate-50 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/45 md:text-left md:text-base"
                              aria-expanded={profileOpen}
                              aria-haspopup="menu"
                              onClick={() => {
                                setMenuOpen(false);
                                setProfileOpen((o) => !o);
                              }}
                            >
                              <span className="border-b border-dotted border-amber-400/50 pb-0.5 decoration-transparent">
                                {handleLabel}
                              </span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-center gap-1.5 md:justify-end">
                            {privilegedAdmin ? (
                              <span className="rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Owner
                              </span>
                            ) : null}
                            {!privilegedAdmin && founder ? (
                              <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                                Founding Member
                              </span>
                            ) : null}
                            {ctx.premiumHeaderTag}
                          </div>

                          {profileOpen ? (
                            <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-md border border-gray-800 bg-black shadow-xl md:left-auto md:right-0 md:translate-x-0">
                              <button
                                type="button"
                                onClick={() => {
                                  void handleProtectedNav("/dashboard/profile").then((ok) => {
                                    if (ok) setProfileOpen(false);
                                  });
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-white transition-colors duration-200 hover:bg-gray-800"
                              >
                                Profile
                              </button>

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
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      aria-expanded={menuOpen}
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      onClick={() => setMenuOpen((o) => !o)}
                      className="rounded-lg p-1.5 text-2xl text-white transition-all duration-200 hover:bg-white/10 md:hidden"
                    >
                      ☰
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[0.07] pt-3 md:mt-5 md:pt-3.5">
                  <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:text-[11px]">
                      <span className="hidden h-px w-8 bg-gradient-to-r from-transparent to-white/15 sm:block" aria-hidden />
                      <span className="text-center">Trust &amp; coverage</span>
                      <span className="hidden h-px w-8 bg-gradient-to-l from-transparent to-white/15 sm:block" aria-hidden />
                    </div>
                    <Link
                      href="/faq#safety-coverage"
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1.5 text-xs font-semibold text-emerald-200/95 transition-all duration-200 hover:border-emerald-400/45 hover:bg-emerald-500/15 hover:text-emerald-100 sm:text-sm"
                    >
                      <Shield className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      Safety Coverage Fund
                    </Link>
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
                              void handleProtectedNav("/dashboard/profile").then((ok) => {
                                if (ok) setMenuOpen(false);
                              });
                            }}
                            className="rounded-lg px-1 py-1 text-left text-white transition-colors duration-200 hover:bg-white/5"
                          >
                            Profile
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
            </div>
          </>
        )}
      />
    </header>
  );
}
