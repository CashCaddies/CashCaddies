"use client";

import { usePathname } from "next/navigation";

const links: readonly { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/lobby", label: "Lobby", match: (p) => p === "/lobby" || p.startsWith("/lobby/") },
  {
    href: "/contests",
    label: "My Contests",
    match: (p) =>
      p === "/contests" ||
      p === "/dashboard" ||
      p === "/dashboard/contests" ||
      p.startsWith("/dashboard/contests/"),
  },
  {
    href: "/lineups",
    label: "My Lineups",
    match: (p) =>
      p === "/lineups" || p === "/dashboard/lineups" || p.startsWith("/dashboard/lineups/"),
  },
];

export function HeaderMainNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="mainNav" aria-label="Main">
      {links.map(({ href, label, match }) => (
        <div key={href} className="relative group">
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-green-400 via-emerald-500 to-yellow-400 p-[2px] opacity-80 transition group-hover:opacity-100" />
          <button
            type="button"
            className="relative rounded-md bg-[#020617] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_8px_rgba(0,255,156,0.5)] transition hover:text-green-300 hover:shadow-[0_0_12px_rgba(255,215,0,0.6)]"
            aria-current={match(pathname) ? "page" : undefined}
            onClick={() => {
              window.location.href = href;
            }}
          >
            {label}
          </button>
        </div>
      ))}
    </nav>
  );
}
