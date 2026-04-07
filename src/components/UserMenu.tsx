"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { FounderBadge } from "@/components/founder-badge";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { hasPermission, isAdmin, isSeniorAdmin } from "@/lib/permissions";

export type UserMenuProfile = {
  avatar_url?: string | null;
  role?: string | null;
  beta_status?: string | null;
  username?: string | null;
  founding_tester?: boolean | null;
};

type Props = {
  profile: UserMenuProfile | null | undefined;
  /** Fallback label, e.g. @handle or Account */
  label: string;
  locked?: boolean;
  /** Paid / admin premium â€” show crown next to handle. */
  premiumSubscriber?: boolean;
};

function DropdownItem({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link href={href} role="menuitem" className="userDropdownLink" onClick={onClick}>
      {children}
    </Link>
  );
}

export default function UserMenu({ profile, label, locked, premiumSubscriber }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Direct `profiles` fetch â€” backup if parent props lag or omit role / founding_tester. */
  const [clientRole, setClientRole] = useState<string | null>(null);
  const [clientFoundingTester, setClientFoundingTester] = useState<boolean | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      if (!user.id) return;

      const { data: row } = await supabase
        .from("profiles")
        .select("role, founding_tester")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (process.env.NODE_ENV === "development") {
        console.log("PROFILE:", row, "ROLE:", row?.role);
      }
      const r = row && typeof (row as { role?: unknown }).role === "string" ? String((row as { role: string }).role).trim() : "";
      if (r) setClientRole(r);
      const ft = row && (row as { founding_tester?: unknown }).founding_tester === true;
      setClientFoundingTester(ft);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  async function signOut() {
    if (!supabase) return;
    close();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const propRole = profile?.role != null && String(profile.role).trim() !== "" ? String(profile.role).trim() : null;
  const effectiveRole = propRole ?? clientRole;
  const isAdminUser = isAdmin(effectiveRole);
  const isSeniorAdminUser = isSeniorAdmin(effectiveRole);
  const showFounderBadge =
    profile?.founding_tester === true || clientFoundingTester === true;

  const avatarSrc = profile?.avatar_url?.trim() || "/default-avatar.svg";
  const roleNorm = String(effectiveRole ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const displayName = (profile?.username?.trim() || label.replace(/^@/, "")).trim() || "Account";

  return (
    <div ref={rootRef} className="userMenu">
      <button
        type="button"
        className="userTrigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        title={displayName}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs from Supabase Storage */}
        <img src={avatarSrc} alt="" className="avatar" width={48} height={48} />
        <div className="userInfo">
          <span className="username inline-flex items-center gap-1">
            {premiumSubscriber ? (
              <span className="text-amber-400" title="Premium member" aria-hidden="true">
                ðŸ‘‘
              </span>
            ) : null}
            {displayName}
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            {showFounderBadge ? <FounderBadge /> : null}
            {roleNorm === "admin" || roleNorm === "senior_admin" ? <span className="adminBadge">ADMIN</span> : null}
          </span>
        </div>
        <span className="sr-only">Open account menu</span>
      </button>

      {open ? (
        <div className="userDropdown" role="menu">
          <p className="userDropdownLabel">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-slate-200">{profile?.username?.trim() ? `@${profile.username.trim()}` : label}</span>
              {showFounderBadge ? <FounderBadge /> : null}
            </span>
          </p>

          {locked ? (
            <>
              <Link href="/closed-beta" role="menuitem" className="userDropdownLink" onClick={close}>
                Closed Beta
              </Link>
              <p className="userDropdownNote" role="note">
                DFS navigation is disabled until your account is approved.
              </p>
              <hr className="userDropdownHr" />
              <button type="button" role="menuitem" className="userDropdownLogoutFlat" onClick={() => void signOut()}>
                Logout
              </button>
            </>
          ) : (
            <>
              <DropdownItem href="/dashboard" onClick={close}>
                Dashboard
              </DropdownItem>
              <DropdownItem href="/lineup-builder" onClick={close}>
                Builder
              </DropdownItem>

              <hr className="userDropdownHr" />

              <DropdownItem href="/profile" onClick={close}>
                Profile
              </DropdownItem>
              <DropdownItem href="/wallet" onClick={close}>
                Wallet
              </DropdownItem>
              <DropdownItem href="/update-password" onClick={close}>
                Settings
              </DropdownItem>

              {isAdminUser && effectiveRole != null ? (
                <>
                  <hr className="userDropdownHr" />
                  <div
                    className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${
                      isSeniorAdminUser ? "text-amber-400" : "text-yellow-400"
                    }`}
                    role="presentation"
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                    {isSeniorAdminUser ? "Senior Admin" : "Admin"}
                  </div>
                  <DropdownItem href="/dashboard/admin" onClick={close}>
                    Admin Panel
                  </DropdownItem>
                  {isSeniorAdminUser ? (
                    <>
                      <DropdownItem href="/dashboard/senior-admin" onClick={close}>
                        Senior Admin
                      </DropdownItem>
                      <DropdownItem href="/dashboard/senior-admin/admins" onClick={close}>
                        Admin Manager
                      </DropdownItem>
                      <DropdownItem href="/dashboard/admin/beta-queue" onClick={close}>
                        Beta Queue
                      </DropdownItem>
                    </>
                  ) : null}
                  {isSeniorAdminUser && hasPermission(effectiveRole, "system_settings") ? (
                    <DropdownItem href="/admin/settlement" onClick={close}>
                      System Controls
                    </DropdownItem>
                  ) : null}
                </>
              ) : null}

              <hr className="userDropdownHr" />

              <button type="button" role="menuitem" className="userDropdownLogoutFlat" onClick={() => void signOut()}>
                Logout
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
