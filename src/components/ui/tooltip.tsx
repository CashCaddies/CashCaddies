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
    <div className="group relative inline-flex">
      {children}

      {/* Tooltip — fade + lift; short delay on show only (no delay on hide) */}
      <div
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-max max-w-[16rem] -translate-x-1/2 translate-y-1 opacity-0 transition-[opacity,transform] delay-0 duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-100"
        role="tooltip"
      >
        <div className="relative w-64 rounded-xl border border-emerald-500/20 bg-[#0b1220]/95 px-4 py-3 text-center text-xs text-white shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {content}

          <div
            className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-emerald-500/20 bg-[#0b1220]/95"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}
