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
        <button
          key={href}
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline-offset-4 hover:underline"
          aria-current={match(pathname) ? "page" : undefined}
          onClick={() => {
            window.location.href = href;
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
