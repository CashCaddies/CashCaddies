"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { FounderBadge } from "@/components/founder-badge";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
  const [profileState, setProfile] = useState<UserMenuProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setAuthUser(user ?? null);

      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("PROFILE LOAD ERROR:", error);
        return;
      }

      if (mounted) {
        setProfile(profile as UserMenuProfile);
      }
    }

    void loadUserData();

    return () => {
      mounted = false;
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
  }

  const propRole = profile?.role != null && String(profile.role).trim() !== "" ? String(profile.role).trim() : null;
  const clientRoleFromFetch =
    profileState?.role != null && String(profileState.role).trim() !== ""
      ? String(profileState.role).trim()
      : null;
  const effectiveRole = propRole ?? clientRoleFromFetch;
  const isAdminUser = isAdmin(effectiveRole);
  const isSeniorAdminUser = isSeniorAdmin(effectiveRole);
  const clientFoundingTester = profileState === null ? null : profileState.founding_tester === true;
  const showFounderBadge =
    profile?.founding_tester === true || clientFoundingTester === true;

  const avatarSrc = profile?.avatar_url?.trim() || "/default-avatar.svg";

  const metaUsername =
    authUser?.user_metadata &&
    typeof authUser.user_metadata.username === "string" &&
    authUser.user_metadata.username.trim() !== ""
      ? authUser.user_metadata.username.trim()
      : "";
  const emailLocal = authUser?.email?.split("@")[0]?.trim() ?? "";
  const profileUsername = (profile?.username?.trim() || profileState?.username?.trim() || "").trim();
  const labelHandle = label.replace(/^@/, "").trim();

  const displayName =
    profileUsername ||
    metaUsername ||
    emailLocal ||
    labelHandle ||
    "Account";

  const adminBadgeLabel = isSeniorAdminUser ? "SENIOR" : "ADMIN";

  return (
    <div ref={rootRef} className="userMenu">
      <div className="userTrigger !gap-3">
        <button
          type="button"
          className="flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          title="Open account menu"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs from Supabase Storage */}
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          </div>
          <span className="sr-only">Open account menu</span>
        </button>

        <Link
          href="/profile"
          className="flex min-w-0 flex-1 flex-col leading-tight text-left text-emerald-400 no-underline transition-colors hover:text-emerald-300"
          onClick={close}
          title={displayName}
        >
          <span className="username inline-flex max-w-[10rem] items-center gap-1 truncate text-sm font-medium">
            {premiumSubscriber ? (
              <span className="shrink-0 text-amber-400" title="Premium member" aria-hidden="true">
                👑
              </span>
            ) : null}
            {displayName}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {showFounderBadge ? <FounderBadge /> : null}
            {isAdminUser ? (
              <span className="text-[10px] px-2 py-[2px] rounded-md bg-gray-600 font-semibold text-white">
                {adminBadgeLabel}
              </span>
            ) : null}
          </div>
        </Link>
      </div>

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
