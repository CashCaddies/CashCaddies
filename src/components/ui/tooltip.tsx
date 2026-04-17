"use client";

import { type ReactNode, useState } from "react";

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}

      {open && (
        <div className="absolute bottom-full left-1/2 z-[9999] mb-4 -translate-x-1/2 pointer-events-none">
          <div className="max-w-[18rem] rounded-lg border border-emerald-500/20 bg-[#0b1220] px-3 py-2 text-center text-xs leading-snug text-white shadow-lg">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
