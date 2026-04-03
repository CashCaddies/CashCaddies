export type BetaPriority = "normal" | "founder" | "vip";

export const BETA_PRIORITIES: readonly BetaPriority[] = ["normal", "founder", "vip"];

export function isBetaPriority(v: string | null | undefined): v is BetaPriority {
  return v === "normal" || v === "founder" || v === "vip";
}

export function parseBetaPriority(raw: unknown): BetaPriority {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "founder" || s === "vip" || s === "normal") return s;
  return "normal";
}
