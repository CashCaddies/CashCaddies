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
 * Premium logo treatment: layered gold glow, float motion, continuous shimmer, breathing inner glow; hover on parent.
 * Logo + CLOSED BETA stack in brandBlock; wordmark in brandText (children).
 */
export function HeaderLogoLink({ href, variant, children, betaBadgeLabel = "CLOSED BETA" }: Props) {
  return (
    <div className="header-logo-link group inline-flex min-w-0 items-center">
      <Link
        href={href}
        title="CashCaddies Closed Beta"
        className="inline-flex shrink-0 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3d8bfd]"
      >
        <div className="logoColumn">
          <span className="inline-block rounded-lg p-0.5">
            <span
              className="header-logo-glow inline-block rounded-lg transition-[box-shadow,transform,filter] duration-[250ms] ease-out will-change-transform group-hover:scale-[1.04] group-active:scale-[0.97] group-hover:shadow-[0_0_22px_rgba(255,215,0,0.35)] group-hover:brightness-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:shadow-none motion-reduce:group-hover:brightness-100"
            >
              <span className="header-logo-shake relative block overflow-visible rounded-xl">
                <div className={`logoWrapper ${variant === "full" ? "logoWrapper--full" : ""}`}>
                  <div className="logoClip">
                    <Image
                      src="/cashcaddies-new-logo.png"
                      alt="CashCaddies"
                      width={480}
                      height={480}
                      className="logo"
                      priority
                      sizes="(max-width: 768px) 120px, 160px"
                    />
                    <div className="logoShine pointer-events-none" aria-hidden />
                    <div className="logoGlow pointer-events-none" aria-hidden />
                  </div>
                </div>
              </span>
            </span>
          </span>
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
