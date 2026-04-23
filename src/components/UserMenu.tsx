"use client";

import Link from "next/link";
import { JoinWaitlistFlow } from "@/components/join-waitlist-flow";
import { FounderBadge } from "@/components/founder-badge";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isAdmin, isSeniorAdmin } from "@/lib/permissions";

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
  /** Paid / admin premium — show crown next to handle. */
  premiumSubscriber?: boolean;
};

const HREF_PROFILE = "/dashboard/profile";

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
  /** Direct `profiles` fetch — backup if parent props lag or omit role / founding_tester. */
  const [profileState, setProfile] = useState<UserMenuProfile | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;

    async function loadUserData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user) return;

      const { data: row, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

      if (error) {
        console.error("PROFILE LOAD ERROR:", error);
        return;
      }

      if (mounted) {
        setProfile(row as UserMenuProfile);
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

  const adminBadgeLabel = isSeniorAdminUser ? "SENIOR" : "ADMIN";

  const handleLine =
    profile?.username?.trim() || profileState?.username?.trim()
      ? `@${(profile?.username?.trim() || profileState?.username?.trim() || "").trim()}`
      : label;

  return (
    <div ref={rootRef} className="userMenu">
      <div className="userTrigger !gap-3">
        <div
          className="avatar flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-yellow-400"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs from Supabase Storage */}
          <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <button
            type="button"
            className="username flex max-w-[10rem] flex-col items-start rounded-md px-0.5 py-0.5 text-left text-sm font-medium text-emerald-400 transition-colors hover:bg-white/5 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((v) => !v)}
            title="Open account menu"
          >
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate">
              {premiumSubscriber ? (
                <span className="shrink-0 text-amber-400" title="Premium member" aria-hidden="true">
                  👑
                </span>
              ) : null}
              <span className="truncate font-semibold tracking-tight">{handleLine}</span>
            </span>
            <span className="sr-only">Open account menu</span>
          </button>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {showFounderBadge ? <FounderBadge /> : null}
            {isAdminUser ? (
              <span className="text-[10px] px-2 py-[2px] rounded-md bg-gray-600 font-semibold text-white">
                {adminBadgeLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {open ? (
        <div className="userDropdown" role="menu">
          <p className="userDropdownLabel">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span className="text-slate-200">{handleLine}</span>
              {showFounderBadge ? <FounderBadge /> : null}
            </span>
          </p>

          {locked ? (
            <div className="border-b border-white/10 px-1 py-2" onClick={(e) => e.stopPropagation()}>
              <JoinWaitlistFlow variant="compact" />
            </div>
          ) : null}

          <DropdownItem href={HREF_PROFILE} onClick={close}>
            Profile
          </DropdownItem>

          <hr className="userDropdownHr" />

          <button type="button" role="menuitem" className="userDropdownLogoutFlat" onClick={() => void signOut()}>
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
