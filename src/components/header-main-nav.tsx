"use client";

import { usePathname } from "next/navigation";

const links: readonly { href: string; label: string }[] = [
  { href: "/lobby", label: "Lobby" },
  { href: "/contests", label: "My Contests" },
  { href: "/lineups", label: "My Lineups" },
];

export function HeaderMainNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="mainNav" aria-label="Main">
      {links.map(({ href, label }) => (
        <div key={href} className="relative group">
          <div
            className={`
      absolute inset-0 rounded-md p-[2px]
      bg-gradient-to-br from-green-400 via-emerald-500 to-yellow-400
      transition duration-200
      ${
        isActive(href)
          ? "opacity-100 shadow-[0_0_14px_rgba(255,215,0,0.9)]"
          : "opacity-60 group-hover:opacity-100"
      }
    `}
          />

          <button
            type="button"
            aria-current={isActive(href) ? "page" : undefined}
            onClick={() => {
              window.location.href = href;
            }}
            className={`
      metal-shine relative overflow-hidden px-4 py-2 rounded-md text-sm font-semibold transition
      ${
        isActive(href)
          ? "text-green-400 bg-[#020617] scale-105"
          : "text-white bg-[#020617] hover:text-green-300"
      }
    `}
          >
            {label}
            <span
              className={`
  absolute bottom-0 left-0 w-full h-[2px]
  bg-gradient-to-r from-green-400 to-yellow-400
  ${isActive(href) ? "opacity-100" : "opacity-0"}
`}
            />
          </button>
        </div>
      ))}
    </nav>
  );
}
