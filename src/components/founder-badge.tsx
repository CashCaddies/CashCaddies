/**
 * Gold “FOUNDER” pill when `profiles.founding_tester` is true.
 * Styles: `globals.css` → `.founderBadge`
 */
export function FounderBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`founderBadge ${className}`.trim()} title="Founding beta member">
      FOUNDER
    </span>
  );
}
