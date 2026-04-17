const founderPillClass =
  "text-[10px] px-2 py-[2px] rounded-md bg-yellow-400 text-black font-semibold";

/**
 * “FOUNDER” pill when `profiles.founding_tester` is true.
 */
export function FounderBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`${founderPillClass} ${className}`.trim()} title="Founding beta member">
      FOUNDER
    </span>
  );
}
