"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  variant: "minimal" | "full";
  /** Wordmark column (CashCaddies + tagline); not scaled with logo */
  children: ReactNode;
  /** Shown under the logo in the left branding column */
  betaBadgeLabel?: string;
};

/**
 * Header brand: animated green/gold glow (`.logo-glow` + `@keyframes logoGlow` in globals.css), CLOSED BETA badge, wordmark in `children`.
 */
export function HeaderLogoLink({ href, variant, children, betaBadgeLabel = "CLOSED BETA" }: Props) {
  void variant;
  return (
    <div className="header-logo-link group inline-flex min-w-0 items-center">
      <Link
        href={href}
        title="CashCaddies Closed Beta"
        className="inline-flex shrink-0 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3d8bfd]"
      >
        <div className="logoColumn">
          <div className="logo-glow">
            <Image
              src="/cashcaddies-new.png?v=3"
              alt="CashCaddies"
              width={140}
              height={140}
              className="h-14 w-auto"
              priority
            />
          </div>
          <span className="betaBadge select-none" title="Closed beta access required for DFS features">
            {betaBadgeLabel}
          </span>
        </div>
      </Link>
      <div className="brandBlock">
        <span className="sr-only">CashCaddies — Daily Fantasy Golf Platform</span>
        {children}
      </div>
    </div>
  );
}
