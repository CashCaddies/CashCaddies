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
    <div className="border-b border-slate-800/80 bg-slate-950/80 px-4 py-2.5 sm:py-3">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-slate-900/70 px-3 py-1 shadow-[inset_0_1px_0_0_rgba(234,179,64,0.08)] sm:gap-2 sm:px-3.5 sm:py-1.5">
          <LockIcon className="h-3 w-3 shrink-0 text-amber-400/85 sm:h-3.5 sm:w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100/90 sm:text-[11px] sm:tracking-[0.14em]">
            Closed Beta – Invite Only
          </span>
        </div>
        <div className="max-w-xl space-y-2 text-[10px] leading-relaxed text-slate-500 sm:text-xs sm:leading-relaxed">
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
