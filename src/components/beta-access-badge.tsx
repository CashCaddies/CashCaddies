function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BetaAccessBadge() {
  return (
    <div className="border-b border-emerald-950/50 bg-slate-950/90 px-4 py-2.5 backdrop-blur-sm sm:py-3">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2.5 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-900/80 px-3.5 py-1.5 shadow-[inset_0_1px_0_0_rgba(234,179,64,0.1)] sm:px-4 sm:py-2">
          <LockIcon className="h-3.5 w-3.5 shrink-0 text-amber-400/90 sm:h-4 sm:w-4" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/95 sm:text-[11px] sm:tracking-[0.16em]">
            Closed Beta – Invite Only
          </span>
        </div>
        <div className="max-w-xl space-y-2 text-[10px] leading-relaxed text-slate-400 sm:text-xs sm:leading-relaxed">
          <p>
            CashCaddies is currently in closed beta testing. We are selecting a small group of fantasy golf players to
            help refine the platform.
          </p>
          <p>
            Request Beta Access:{" "}
            <a
              href="mailto:contact@cashcaddies.com"
              className="font-medium text-emerald-400/90 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
            >
              contact@cashcaddies.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
