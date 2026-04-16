"use client";

import type { ReactNode } from "react";

type Props = {
  href: string;
  variant: "minimal" | "full";
  children: ReactNode;
  betaBadgeLabel?: string;
};

/** Logo removed; brand column lives in `site-header.tsx`. Props kept for call-site compatibility. */
export function HeaderLogoLink(_props: Props): null {
  return null;
}
