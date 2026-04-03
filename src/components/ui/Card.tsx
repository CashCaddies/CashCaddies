import type { ReactNode } from "react";
import { BORDERS, COLORS, EFFECTS } from "@/lib/design-tokens";

export default function Card({
  children,
  highlight = false,
  className = "",
}: {
  children: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: COLORS.card,
        border: highlight ? BORDERS.gold : BORDERS.subtle,
        boxShadow: highlight ? EFFECTS.goldGlow : EFFECTS.cardShadow,
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      {children}
    </div>
  );
}

