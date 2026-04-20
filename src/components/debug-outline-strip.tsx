"use client";

import { useEffect } from "react";

/** Removes stray .debug-outline from the DOM (e.g. cached HTML or extensions). */
export function DebugOutlineStrip() {
  useEffect(() => {
    document.querySelectorAll(".debug-outline").forEach((el) => {
      el.classList.remove("debug-outline");
    });
  }, []);

  return null;
}
