"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { isAdmin } from "@/lib/permissions";

export type DashboardNavMode = "dashboard" | "single";

const HREF_MY_STUFF = "/dashboard";
const HREF_WAITLIST = "/dashboard/admin/waitlist";
const HREF_CREATE_CONTEST = "/admin/contests";

function navButtonClass(active: boolean) {
  if (active) {
    return "inline-flex items-center rounded-md px-4 py-2 text-base font-semibold transition bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40";
  }
  return "inline-flex items-center rounded-md px-4 py-2 text-base font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white";
}

function dropdownItemClass(active: boolean) {
  return `block w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition ${
    active ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40" : "text-slate-300 hover:bg-slate-800 hover:text-white"
  }`;
}

function staffRoutesActive(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/admin") ||
    pathname.startsWith("/dashboard/senior-admin") ||
    pathname.startsWith("/admin/contests")
  );
}

/** True when the user is in the main app shell (not staff admin URLs). */
function dashboardSectionActive(pathname: string): boolean {
  if (staffRoutesActive(pathname)) return false;
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/contests") ||
    pathname.startsWith("/lineups") ||
    pathname.startsWith("/lobby") ||
    pathname.startsWith("/wallet") ||
    pathname === "/profile"
  );
}

function DashboardMyMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sectionActive = dashboardSectionActive(pathname);
  const myStuffActive =
    pathname === HREF_MY_STUFF || (pathname.startsWith("/dashboard/") && !staffRoutesActive(pathname));

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${navButtonClass(sectionActive)} gap-2`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          Dashboard
          <span className="text-xs opacity-80" aria-hidden="true">
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[90] mt-1 min-w-[12rem] rounded-md border border-slate-700/90 bg-slate-950 py-1 shadow-[0_18px_45px_rgba(0,0,0,0.55)] ring-1 ring-black/60"
          role="menu"
          aria-label="Dashboard navigation"
        >
          <Link
            href={HREF_MY_STUFF}
            role="menuitem"
            className={dropdownItemClass(myStuffActive)}
            aria-current={myStuffActive ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            My Stuff
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type DashboardStaffMenuProps = {
  pathname: string;
};

function DashboardStaffMenu({ pathname }: DashboardStaffMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const waitlistActive = pathname === HREF_WAITLIST || pathname.startsWith(`${HREF_WAITLIST}/`);
  const createContestActive =
    pathname === HREF_CREATE_CONTEST || pathname.startsWith(`${HREF_CREATE_CONTEST}/`);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${navButtonClass(sectionActive)} gap-2`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-1.5">
          Admin
          <span className="text-xs opacity-80" aria-hidden="true">
            ▾
          </span>
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-[90] mt-1 min-w-[14rem] rounded-md border border-slate-700/90 bg-slate-950 py-1 shadow-[0_18px_45px_rgba(0,0,0,0.55)] ring-1 ring-black/60"
          role="menu"
          aria-label="Admin navigation"
        >
          <Link
            href={HREF_WAITLIST}
            role="menuitem"
            className={dropdownItemClass(waitlistActive)}
            aria-current={waitlistActive ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            Access requests
          </Link>
          <Link
            href={HREF_CREATE_CONTEST}
            role="menuitem"
            className={dropdownItemClass(createContestActive)}
            aria-current={createContestActive ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            Contest Admin
          </Link>
        </div>
      ) : null}
    </div>
  );
}

type DashboardNavProps = {
  mode?: DashboardNavMode;
};

export function DashboardNav({ mode: _mode = "single" }: DashboardNavProps) {
  const pathname = usePathname() ?? "";
  const { wallet, fullUser, loading } = useWallet();

  const profileRole = useMemo(() => {
    if (loading) return null;
    const wr = typeof wallet?.role === "string" ? wallet.role.trim() : "";
    if (wr) return wr;
    const fr = typeof fullUser?.role === "string" ? fullUser.role.trim() : "";
    return fr || null;
  }, [loading, wallet?.role, fullUser?.role]);

  const showStaffMenu = !loading && isAdmin(profileRole);

  return (
    <nav className="relative z-30 flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4" aria-label="Dashboard">
      <DashboardMyMenu pathname={pathname} />
      {showStaffMenu ? <DashboardStaffMenu pathname={pathname} /> : null}
    </nav>
  );
}
