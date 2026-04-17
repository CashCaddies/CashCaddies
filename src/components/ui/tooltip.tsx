"use client";

import type { ReactNode } from "react";

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  return (
    <div className="header-tooltip group relative inline-flex overflow-visible">
      {children}

      {/* Tooltip ABOVE */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-3 -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100"
        role="tooltip"
      >
        <div className="relative w-64 rounded-xl border border-emerald-500/20 bg-[#0b1220]/95 px-4 py-3 text-center text-xs text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {content}

          <div
            className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-emerald-500/20 bg-[#0b1220]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
