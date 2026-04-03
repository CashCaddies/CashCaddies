import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-800/70 bg-slate-950 py-8 sm:py-10">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-slate-500 sm:text-sm">
          <Link href="/terms" className="font-semibold text-emerald-400/95 hover:text-emerald-300">
            Terms
          </Link>
          <span className="text-slate-600" aria-hidden>
            |
          </span>
          <Link href="/privacy" className="font-semibold text-emerald-400/95 hover:text-emerald-300">
            Privacy
          </Link>
          <span className="text-slate-600" aria-hidden>
            |
          </span>
          <a
            href="mailto:contact@cashcaddies.com"
            className="font-semibold text-emerald-400/95 transition-colors hover:text-emerald-300"
          >
            Contact
          </a>
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Contact:{" "}
          <a
            href="mailto:contact@cashcaddies.com"
            className="transition-colors hover:text-emerald-400"
          >
            contact@cashcaddies.com
          </a>
        </p>
        <p className="mt-4 text-sm font-medium text-slate-400 sm:text-base">
          © 2026 CashCaddies. All rights reserved.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 sm:text-sm">
          CashCaddies is a fantasy golf analytics platform currently in beta. Features may change.
        </p>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-600 sm:mt-4 sm:text-xs">
          Not affiliated with any companies or organizations. For partnership or affiliation inquiries contact:{" "}
          <a
            href="mailto:contact@cashcaddies.com"
            className="font-medium text-emerald-400/90 underline decoration-emerald-500/30 underline-offset-2 hover:text-emerald-300"
          >
            contact@cashcaddies.com
          </a>
        </p>
      </div>
    </footer>
  );
}
