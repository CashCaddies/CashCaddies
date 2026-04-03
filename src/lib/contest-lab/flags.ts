/** Server + client: enable Contest Lab (Simulation Engine) beta UI and API. */
export function isContestLabEnabledServer(): boolean {
  const v = process.env.CONTEST_LAB_ENABLED ?? process.env.NEXT_PUBLIC_CONTEST_LAB_ENABLED;
  return v === "1" || v === "true" || v === "yes";
}

export function isContestLabEnabledClient(): boolean {
  const v =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_CONTEST_LAB_ENABLED : undefined;
  return v === "1" || v === "true" || v === "yes";
}
