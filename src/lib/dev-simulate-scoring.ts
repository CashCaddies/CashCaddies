/**
 * True when simulate scoring is allowed (browser or server). Uses `NEXT_PUBLIC_ALLOW_SIMULATE_SCORING`
 * so the same check works in client components.
 */
export function isDevSimulateScoringAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_SIMULATE_SCORING === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_SIMULATE_SCORING === "true"
  );
}
