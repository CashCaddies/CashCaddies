import { isProfileBetaApproved } from "@/lib/beta-profile-filters";
import { isAdmin } from "@/lib/permissions";

/** Admins bypass app access checks; otherwise requires an approved beta profile for product areas. */
export function hasClosedBetaAppAccess(
  row: { beta_user?: boolean | null; beta_status?: string | null } | null | undefined,
  role: string | null | undefined,
): boolean {
  if (isAdmin(role)) return true;
  return isProfileBetaApproved(row ?? {});
}
