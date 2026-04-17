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
    <div
      data-header-tooltip
      className="group/headerTooltip relative z-[100] inline-flex overflow-visible"
    >
      {children}

      <div
        className="pointer-events-none absolute inset-0 z-[9999] flex items-start justify-center opacity-0 transition-all delay-0 duration-200 ease-out group-hover/headerTooltip:opacity-100 group-hover/headerTooltip:delay-75"
        role="tooltip"
      >
        <div className="relative mt-16 w-64 rounded-xl border border-emerald-500/20 bg-[#0b1220]/95 px-4 py-3 text-center text-xs text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {content}

          <div
            className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-emerald-500/20 bg-[#0b1220]"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
