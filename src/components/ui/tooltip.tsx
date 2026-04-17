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

      <div className="pointer-events-none absolute bottom-full left-1/2 z-[9999] mb-3 w-max max-w-[min(90vw,18rem)] -translate-x-1/2 opacity-0 transition-all duration-200 group-hover:opacity-100">
        <div className="rounded-lg border border-emerald-500/20 bg-[#0b1220] px-3 py-2 text-center text-xs leading-snug text-white shadow-lg">
          {content}
        </div>
      </div>
    </div>
  );
}
