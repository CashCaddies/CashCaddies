/** Small shield for protected-golfer UI (consistent across app). */
export function ProtectedGolferShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M9.661 1.113a1.75 1.75 0 0 1 .678 0l6.5 1.625a.75.75 0 0 1 .573.73V9.25c0 3.5-2.5 6.5-7.5 8.5-5-2-7.5-5-7.5-8.5V3.468a.75.75 0 0 1 .573-.73l6.5-1.625ZM10 2.445 4 3.945V9.25c0 2.75 1.9 5.1 6 6.9 4.1-1.8 6-4.15 6-6.9V3.945l-6-1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Inline badge for contest entry rows / lineup cards. */
export function ProtectedEntryBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100/95">
      Protected Entry <span aria-hidden>🛡</span>
    </span>
  );
}

/** Tooltip copy for lineup builder protected slot (native title; newlines work in many browsers). */
export function protectedGolferCardTooltip(): string {
  return "Protected Golfer\n\nIf this golfer misses the cut,\nCashCaddies safety coverage may apply.";
}
