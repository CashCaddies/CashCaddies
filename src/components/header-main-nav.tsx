"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: readonly { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/lobby", label: "Lobby", match: (p) => p === "/lobby" || p.startsWith("/lobby/") },
  {
    href: "/dashboard/contests",
    label: "My Contests",
    match: (p) => p === "/dashboard" || p === "/dashboard/contests" || p.startsWith("/dashboard/contests/"),
  },
  {
    href: "/dashboard/lineups",
    label: "My Lineups",
    match: (p) => p === "/dashboard/lineups" || p.startsWith("/dashboard/lineups/"),
  },
];

export function HeaderMainNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="mainNav" aria-label="Main">
      {links.map(({ href, label, match }) => (
        <Link key={href} href={href} aria-current={match(pathname) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
