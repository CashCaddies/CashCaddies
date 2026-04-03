import { isProfileBetaApproved } from "@/lib/beta-profile-filters";
import { isAdmin } from "@/lib/permissions";

/** Staff (`profiles.role` admin or senior_admin) bypass closed-beta product gates. */
export function hasClosedBetaAppAccess(
  row: { beta_user?: boolean | null; beta_status?: string | null } | null | undefined,
  role: string | null | undefined,
): boolean {
  if (isAdmin(role)) return true;
  return isProfileBetaApproved(row ?? {});
}
