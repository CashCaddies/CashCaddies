export type PortalTier = "weekly" | "biweekly" | "monthly";

export function calculateSurplus(totalFund: number, requiredBuffer: number) {
  return Math.max(0, totalFund - requiredBuffer);
}

export function getUnlockedTiers(surplus: number) {
  const tiers: PortalTier[] = [];

  const SMALL = 500; // weekly
  const MEDIUM = 2000; // bi-weekly
  const LARGE = 10000; // monthly

  if (surplus >= SMALL) tiers.push("weekly");
  if (surplus >= MEDIUM) tiers.push("biweekly");
  if (surplus >= LARGE) tiers.push("monthly");

  return tiers;
}

export function getTierLabel(tier: PortalTier) {
  switch (tier) {
    case "weekly":
      return "Weekly Portal (Small)";
    case "biweekly":
      return "Bi-Weekly Portal (Medium)";
    case "monthly":
      return "Monthly Portal (Large)";
  }
}

export function getOverlayAmount(surplus: number, tier: PortalTier) {
  switch (tier) {
    case "weekly":
      return Math.floor(surplus * 0.05);

    case "biweekly":
      return Math.floor(surplus * 0.1);

    case "monthly":
      return Math.floor(surplus * 0.2);
  }
}
