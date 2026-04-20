"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { getAdminNewFeedbackCount } from "@/app/(protected)/admin/feedback/actions";
import { isAdmin, isSeniorAdmin } from "@/lib/permissions";

export type DashboardNavMode = "dashboard" | "single";

type DashboardNavLink = {
  href: string;
  label: string;
  match: (p: string) => boolean;
};

const lobbyLink: DashboardNavLink = {
  href: "/lobby",
  label: "Lobby",
  match: (p: string) => p === "/lobby" || p.startsWith("/lobby/"),
};

const myContestsNavLinkFull: DashboardNavLink = {
  href: "/contests",
  label: "My Contests",
  match: (p: string) =>
    p === "/contests" ||
    p === "/dashboard" ||
    p === "/dashboard/contests" ||
    p.startsWith("/dashboard/contests/"),
};

const lineupsNavLink: DashboardNavLink = {
  href: "/lineups",
  label: "My Lineups",
  match: (p: string) =>
    p === "/lineups" || p === "/dashboard/lineups" || p.startsWith("/dashboard/lineups/"),
};

const winningsNavLink: DashboardNavLink = {
  href: "/dashboard/winnings",
  label: "My Winnings",
  match: (p: string) => p === "/dashboard/winnings" || p.startsWith("/dashboard/winnings/"),
};

const profileNavLink: DashboardNavLink = {
  href: "/dashboard/profile",
  label: "Profile",
  match: (p: string) => p === "/dashboard/profile" || p.startsWith("/dashboard/profile/"),
};

const feedbackNavLink: DashboardNavLink = {
  href: "/dashboard/feedback",
  label: "Feedback",
  match: (p: string) => p === "/dashboard/feedback" || p.startsWith("/dashboard/feedback/"),
};

/** Primary row: no Feedback / Feedback Inbox (those live under More). */
const primaryLinks: readonly DashboardNavLink[] = [
  lobbyLink,
  myContestsNavLinkFull,
  lineupsNavLink,
  winningsNavLink,
  profileNavLink,
];

const HREF_ADMIN_PANEL = "/dashboard/admin";
const HREF_SENIOR_ADMIN = "/dashboard/senior-admin";
const HREF_BETA_QUEUE = "/dashboard/admin/beta-queue";
const HREF_USER_MANAGER = "/dashboard/senior-admin/admins";

const adminBetaUsersLink: DashboardNavLink = {
  href: "/dashboard/beta-management",
  label: "Beta Users",
  match: (p: string) => p === "/dashboard/beta-management" || p.startsWith("/dashboard/beta-management/"),
};

const adminFeedbackPath = "/admin/feedback";
const adminFeedbackDefaultHref = adminFeedbackPath;

const adminFeedbackLink: DashboardNavLink = {
  href: adminFeedbackDefaultHref,
  label: "Feedback Inbox",
  match: (p: string) => p === adminFeedbackPath || p.startsWith(`${adminFeedbackPath}/`),
};

const myContestsNavLinkSingle: DashboardNavLink = {
  href: "/contests",
  label: "My Contests",
  match: (p: string) =>
    p === "/contests" || p === "/dashboard/contests" || p.startsWith("/dashboard/contests/"),
};

type SingleNavResolution =
  | { kind: "links"; links: DashboardNavLink[] }
  | { kind: "more-feedback" };

function resolveSingleDashboardNav(pathname: string): SingleNavResolution {
  const p = pathname || "";
  if (p === "/contests" || p === "/dashboard/contests" || p.startsWith("/dashboard/contests/")) {
    return { kind: "links", links: [myContestsNavLinkSingle] };
  }
  if (p === "/lineups" || p === "/dashboard/lineups" || p.startsWith("/dashboard/lineups/")) {
    return { kind: "links", links: [lineupsNavLink] };
  }
  if (p === "/dashboard/winnings" || p.startsWith("/dashboard/winnings/")) {
    return { kind: "links", links: [winningsNavLink] };
  }
  if (p === "/dashboard/profile" || p.startsWith("/dashboard/profile/")) {
    return { kind: "links", links: [profileNavLink] };
  }
  if (p === "/dashboard/feedback" || p.startsWith("/dashboard/feedback/")) {
    return { kind: "more-feedback" };
  }
  if (p === "/dashboard/beta-management" || p.startsWith("/dashboard/beta-management/")) {
    return { kind: "links", links: [adminBetaUsersLink] };
  }
  return { kind: "links", links: [] };
}

function navButtonClass(active: boolean, opts?: { pulseAttention?: boolean }) {
  if (active) {
    return "inline-flex items-center rounded-md px-4 py-2 text-base font-semibold transition bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40";
  }
  if (opts?.pulseAttention) {
    return "inline-flex items-center rounded-md px-4 py-2 text-base font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white";
  }
  return "inline-flex items-center rounded-md px-4 py-2 text-base font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white";
}

function dropdownItemClass(active: boolean) {
  return `block w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
    active ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40" : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;
}

/** Full page navigation — avoids stale client state after route change. */
function NavDashButton({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={navButtonClass(active)}
      aria-current={active ? "page" : undefined}
      onClick={() => {
        window.location.href = href;
      }}
    >
      {children}
    </button>
  );
}

function staffRoutesActive(pathname: string): boolean {
  return pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/senior-admin");
}

type DashboardStaffMenuProps = {
  pathname: string;
  /** Resolved `profiles.role` (or equivalent) for permission checks. */
  role: string | null;
};

/**
 * Staff dropdown: Admin Panel for any staff (`isAdmin`); senior-only links for `senior_admin`.
 */
function DashboardStaffMenu({ pathname, role }: DashboardStaffMenuProps) {
  const staff = isAdmin(role);
  const senior = isSeniorAdmin(role);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const adminPanelActive = pathname === HREF_ADMIN_PANEL;
  const seniorActive = pathname === HREF_SENIOR_ADMIN || pathname.startsWith(`${HREF_SENIOR_ADMIN}/`);
  const betaQueueActive = pathname === HREF_BETA_QUEUE || pathname.startsWith(`${HREF_BETA_QUEUE}/`);
  const userManagerActive = pathname === HREF_USER_MANAGER || pathname.startsWith(`${HREF_USER_MANAGER}/`);

  const sectionActive = staffRoutesActive(pathname);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = navButtonClass(sectionActive);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${triggerClass} gap-2`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          {senior ? "Senior Admin" : "Admin"}
          <span className="text-xs opacity-80" aria-hidden="true">
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg ring-1 ring-black/40"
          role="menu"
          aria-label="Admin navigation"
        >
          {staff ? (
            <Link
              href={HREF_ADMIN_PANEL}
              role="menuitem"
              className={dropdownItemClass(adminPanelActive)}
              aria-current={adminPanelActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              Admin Panel
            </Link>
          ) : null}
          {senior ? (
            <Link
              href={HREF_SENIOR_ADMIN}
              role="menuitem"
              className={dropdownItemClass(seniorActive)}
              aria-current={seniorActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              Senior Admin
            </Link>
          ) : null}
          {senior ? (
            <Link
              href={HREF_BETA_QUEUE}
              role="menuitem"
              className={dropdownItemClass(betaQueueActive)}
              aria-current={betaQueueActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              Beta Queue
            </Link>
          ) : null}
          {senior ? (
            <Link
              href={HREF_USER_MANAGER}
              role="menuitem"
              className={dropdownItemClass(userManagerActive)}
              aria-current={userManagerActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              User Manager
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type MoreMenuProps = {
  pathname: string;
  showAdminFeedback: boolean;
  newFeedbackCount: number | null;
};

function DashboardMoreMenu({ pathname, showAdminFeedback, newFeedbackCount }: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const feedbackActive = feedbackNavLink.match(pathname);
  const inboxActive = showAdminFeedback && adminFeedbackLink.match(pathname);
  const moreSectionActive = feedbackActive || inboxActive;
  const hasNewInbox =
    showAdminFeedback && newFeedbackCount != null && newFeedbackCount > 0 ? newFeedbackCount : null;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = navButtonClass(moreSectionActive, {
    pulseAttention: hasNewInbox != null && !open,
  });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${triggerClass} gap-2`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          More
          <span className="text-xs opacity-80" aria-hidden="true">
            ▾
          </span>
        </span>
        {hasNewInbox != null ? (
          <span
            className="ml-2 inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300 animate-pulse tabular-nums font-semibold"
            aria-label={`${hasNewInbox} new feedback items in inbox`}
          >
            {hasNewInbox}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-[12rem] rounded-md border border-slate-700 bg-slate-900 py-1 shadow-lg ring-1 ring-black/40"
          role="menu"
          aria-label="More navigation"
        >
          <Link
            href={feedbackNavLink.href}
            role="menuitem"
            className={dropdownItemClass(feedbackActive)}
            aria-current={feedbackActive ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {feedbackNavLink.label}
          </Link>
          {showAdminFeedback ? (
            <Link
              href={adminFeedbackDefaultHref}
              role="menuitem"
              className={dropdownItemClass(inboxActive)}
              aria-current={inboxActive ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {hasNewInbox != null ? `Feedback Inbox (${hasNewInbox})` : adminFeedbackLink.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type DashboardNavProps = {
  mode?: DashboardNavMode;
};

export function DashboardNav({ mode = "single" }: DashboardNavProps) {
  const pathname = usePathname() ?? "";
  const { wallet, fullUser, loading, user } = useWallet();
  const [newFeedbackCount, setNewFeedbackCount] = useState<number | null>(null);

  /** `profiles.role` from wallet row first, then `fullUser.role` (same underlying row). */
  const profileRole = useMemo(() => {
    if (loading) return null;
    const wr = typeof wallet?.role === "string" ? wallet.role.trim() : "";
    if (wr) return wr;
    const fr = typeof fullUser?.role === "string" ? fullUser.role.trim() : "";
    return fr || null;
  }, [loading, wallet?.role, fullUser?.role]);

  const showBetaUsers = !loading && wallet?.founding_tester === true;
  const resolvedRole = profileRole;
  const showAdminFeedback = !loading && isAdmin(resolvedRole ?? fullUser?.role);
  const showStaffMenu = !loading && isAdmin(resolvedRole ?? fullUser?.role);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || loading) return;
    console.log(
      "[dashboard-nav] PROFILE wallet:",
      wallet,
      "ROLE:",
      wallet?.role,
      "fullUser.role:",
      fullUser?.role,
      "resolved:",
      resolvedRole,
    );
  }, [loading, wallet, fullUser?.role, resolvedRole]);

  const refreshNewCount = useCallback(async () => {
    if (!user?.id) {
      setNewFeedbackCount(null);
      return;
    }
    if (!isAdmin(profileRole ?? fullUser?.role)) {
      setNewFeedbackCount(null);
      return;
    }
    const r = await getAdminNewFeedbackCount();
    if (r.ok) {
      setNewFeedbackCount(r.count);
    }
  }, [user?.id, profileRole, fullUser?.role]);

  useEffect(() => {
    void refreshNewCount();
  }, [refreshNewCount]);

  useEffect(() => {
    const onUpdate = () => {
      void refreshNewCount();
    };
    window.addEventListener("admin-feedback-updated", onUpdate);
    return () => window.removeEventListener("admin-feedback-updated", onUpdate);
  }, [refreshNewCount]);

  if (mode === "dashboard") {
    return (
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4" aria-label="Dashboard">
        {primaryLinks.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <NavDashButton key={href} href={href} active={active}>
              {label}
            </NavDashButton>
          );
        })}
        <DashboardMoreMenu pathname={pathname} showAdminFeedback={showAdminFeedback} newFeedbackCount={newFeedbackCount} />
        {showStaffMenu ? <DashboardStaffMenu pathname={pathname} role={resolvedRole} /> : null}
        {showBetaUsers ? (
          <NavDashButton href={adminBetaUsersLink.href} active={adminBetaUsersLink.match(pathname)}>
            {adminBetaUsersLink.label}
          </NavDashButton>
        ) : null}
      </nav>
    );
  }

  const single = resolveSingleDashboardNav(pathname);

  if (single.kind === "more-feedback") {
    return (
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4" aria-label="Dashboard">
        <DashboardMoreMenu pathname={pathname} showAdminFeedback={showAdminFeedback} newFeedbackCount={newFeedbackCount} />
        {showStaffMenu ? <DashboardStaffMenu pathname={pathname} role={resolvedRole} /> : null}
      </nav>
    );
  }

  if (single.links.length === 0) {
    return (
      <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4" aria-label="Dashboard">
        {primaryLinks.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <NavDashButton key={href} href={href} active={active}>
              {label}
            </NavDashButton>
          );
        })}
        <DashboardMoreMenu pathname={pathname} showAdminFeedback={showAdminFeedback} newFeedbackCount={newFeedbackCount} />
        {showStaffMenu ? <DashboardStaffMenu pathname={pathname} role={resolvedRole} /> : null}
        {showBetaUsers ? (
          <NavDashButton href={adminBetaUsersLink.href} active={adminBetaUsersLink.match(pathname)}>
            {adminBetaUsersLink.label}
          </NavDashButton>
        ) : null}
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4" aria-label="Dashboard">
      {single.links.map(({ href, label, match }) => {
        const active = match(pathname);
        return (
          <NavDashButton key={href} href={href} active={active}>
            {label}
          </NavDashButton>
        );
      })}
    </nav>
  );
}
