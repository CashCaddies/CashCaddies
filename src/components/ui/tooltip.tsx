"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

export function Tooltip({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, flip: false });

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const padding = 12;
    const tooltipHeight = 60; // approximate
    const yAbove = e.clientY - tooltipHeight - padding;

    setPos({
      x: e.clientX,
      y: e.clientY,
      flip: yAbove < 0, // if too close to top → flip below
    });
  }

  return (
    <div
      className="inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onMouseMove={handleMove}
    >
      {children}

      {open && (
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{
            left: pos.x,
            top: pos.flip ? pos.y + 16 : pos.y - 16,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="max-w-[18rem] rounded-lg border border-emerald-500/20 bg-[#0b1220] px-3 py-2 text-center text-xs leading-snug text-white shadow-lg"
            style={{
              transform: pos.flip ? "translateY(0)" : "translateY(-100%)",
            }}
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
